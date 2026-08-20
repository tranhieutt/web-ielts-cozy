/**
 * Supabase Anonymous Auth adapter (VOC-API-01).
 *
 * Raw REST against GoTrue, matching `repository.supabase.ts`. Pulling in
 * `@supabase/supabase-js` for two endpoints would add a dependency and a second
 * way of talking to the same project.
 *
 * Only the PUBLISHABLE key is used. Anonymous sign-in and refresh are both
 * public operations by design, and the service-role key must never reach this
 * layer — RLS is the thing that decides what a learner may read or write.
 */

const REFRESH_SKEW_SECONDS = 60;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  learnerId: string;
}

/**
 * The project's anonymous sign-in quota is exhausted for this IP.
 *
 * ADR-004 raised the limit to 50/hour/IP precisely because learners cluster
 * behind shared NAT. Hitting it is still possible, and callers must render an
 * explicit message rather than a blank screen.
 */
export class AuthRateLimitError extends Error {
  constructor() {
    super('anonymous sign-in rate limit reached for this network');
    this.name = 'AuthRateLimitError';
  }
}

/** Auth is configured but unreachable or rejecting. Never means "no learner". */
export class AuthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUnavailableError';
  }
}

function config() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) return null;
  return { url, key };
}

/** True when real Anonymous Auth is available; false selects the dev placeholder. */
export function isConfigured(): boolean {
  return config() !== null;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  user?: { id?: string; is_anonymous?: boolean };
}

async function postAuth(path: string, body: unknown): Promise<TokenPair> {
  const cfg = config();
  if (!cfg) throw new AuthUnavailableError('Supabase auth is not configured');

  let response: Response;
  try {
    response = await fetch(`${cfg.url}/auth/v1/${path}`, {
      method: 'POST',
      headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      // An identity request is never a cacheable read.
      cache: 'no-store',
    });
  } catch (cause) {
    throw new AuthUnavailableError(`Supabase auth unreachable: ${String(cause)}`);
  }

  if (response.status === 429) throw new AuthRateLimitError();
  if (!response.ok) {
    throw new AuthUnavailableError(
      `Supabase auth failed (${response.status}): ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as TokenResponse;
  const { access_token: accessToken, refresh_token: refreshToken } = payload;
  const learnerId = payload.user?.id;

  if (!accessToken || !refreshToken || !learnerId) {
    throw new AuthUnavailableError('Supabase auth returned an incomplete session');
  }
  return { accessToken, refreshToken, learnerId };
}

/**
 * Mint a brand new anonymous learner.
 *
 * Per D-12 the returned UUID IS the `learner_id`. Signing in with Google later
 * links onto this same UUID (`enable_manual_linking = true`), so no row ever
 * migrates.
 */
export async function signInAnonymously(): Promise<TokenPair> {
  return postAuth('signup', {});
}

export async function refreshSession(refreshToken: string): Promise<TokenPair> {
  return postAuth('token?grant_type=refresh_token', { refresh_token: refreshToken });
}

/**
 * Read `sub` and `exp` out of a JWT without verifying it.
 *
 * Deliberately unverified: this is used only to decide *when to refresh* and to
 * label the request. It is NOT an authorization decision. Every read and write
 * of learner data goes to PostgREST carrying this token, and Supabase verifies
 * the signature there — a forged cookie yields no rows rather than someone
 * else's rows. Never grant access on the strength of this function alone.
 */
export function readClaims(token: string): { sub: string; exp: number } | null {
  const segments = token.split('.');
  if (segments.length !== 3) return null;

  try {
    const json = Buffer.from(segments[1], 'base64url').toString('utf8');
    const claims = JSON.parse(json) as { sub?: unknown; exp?: unknown };
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number') return null;
    return { sub: claims.sub, exp: claims.exp };
  } catch {
    return null;
  }
}

/** True when the access token is expired, or close enough that it will be mid-flight. */
export function isExpired(exp: number, nowMs: number = Date.now()): boolean {
  return exp - REFRESH_SKEW_SECONDS <= Math.floor(nowMs / 1000);
}

/* ------------------------------------------------------------------ *
 * Google identity linking (VOC-API-01)
 *
 * Deliberately `linkIdentity`, NOT `signInWithOAuth`. Signing in with Google
 * from an anonymous session would authenticate a DIFFERENT user and strand the
 * anonymous learner's progress. Linking attaches the Google identity to the
 * SAME `auth.users` row, which is the whole reason ADR-004 requires
 * `enable_manual_linking = true`.
 *
 * PKCE, not implicit: the code is exchanged server-side so tokens never land in
 * a URL fragment the browser (and its history) can see. That is also what D-13
 * requires — the UI never holds database credentials.
 * ------------------------------------------------------------------ */

/**
 * Ask GoTrue where to send the learner, carrying their anonymous session.
 *
 * The authorize endpoint needs the learner's Bearer token, which the browser
 * does not have, so the redirect is resolved here and only the resulting Google
 * URL is handed to the browser.
 */
export async function buildGoogleLinkUrl(
  accessToken: string,
  redirectTo: string,
  codeChallenge: string,
): Promise<string> {
  const cfg = config();
  if (!cfg) throw new AuthUnavailableError('Supabase auth is not configured');

  const query = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
    code_challenge: codeChallenge,
    code_challenge_method: 's256',
  });

  let response: Response;
  try {
    response = await fetch(`${cfg.url}/auth/v1/user/identities/authorize?${query}`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${accessToken}` },
      redirect: 'manual',
      cache: 'no-store',
    });
  } catch (cause) {
    throw new AuthUnavailableError(`Supabase auth unreachable: ${String(cause)}`);
  }

  const location = response.headers.get('location');
  if (!location) {
    throw new AuthUnavailableError(
      `Supabase did not return a provider redirect (${response.status}): ${await response.text()}`,
    );
  }
  return location;
}

/** Trade the callback's `?code=` for a session. Fails closed on a mismatched verifier. */
export async function exchangeCodeForSession(
  authCode: string,
  codeVerifier: string,
): Promise<TokenPair> {
  return postAuth('token?grant_type=pkce', {
    auth_code: authCode,
    code_verifier: codeVerifier,
  });
}
