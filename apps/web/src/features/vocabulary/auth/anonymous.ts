/**
 * Supabase Anonymous Auth over the GoTrue REST API (`VOC-API-01`).
 *
 * D-12: the anonymous user's UUID IS `learner_id`. There is no separate guest
 * id and nothing is migrated when the learner links an identity later — the row
 * they already own simply gains a way to sign back in (ADR-004).
 *
 * Raw `fetch` rather than an SDK, matching the importer scripts and
 * `repository.supabase.ts`, so the app ships no Supabase client bundle.
 */

export interface AnonymousSession {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. Absolute, not a duration, so it survives being stored. */
  expiresAt: number;
  learnerId: string;
}

export class AnonymousAuthError extends Error {}

export interface AuthConfig {
  url: string;
  publishableKey: string;
  fetchImpl?: typeof fetch;
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: { id?: string };
}

/**
 * Reads `sub` out of a JWT WITHOUT verifying the signature.
 *
 * That is safe here only because this value is never the thing that authorises
 * anything: it is a label used for cache keys and logging. Authority lives with
 * Supabase, which verifies the same token on every request and applies RLS via
 * `auth.uid()`. Never promote this value into an authorisation decision.
 */
function learnerIdFromToken(accessToken: string): string {
  const segments = accessToken.split('.');
  if (segments.length !== 3) throw new AnonymousAuthError('access token is not a JWT');

  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as {
      sub?: string;
    };
    if (!payload.sub) throw new AnonymousAuthError('access token carries no subject');
    return payload.sub;
  } catch (error) {
    if (error instanceof AnonymousAuthError) throw error;
    throw new AnonymousAuthError('access token payload is not readable JSON');
  }
}

function toSession(body: TokenResponse, now: number): AnonymousSession {
  const { access_token: accessToken, refresh_token: refreshToken, expires_in: expiresIn } = body;

  if (!accessToken || !refreshToken || !expiresIn) {
    throw new AnonymousAuthError('auth response is missing token fields');
  }

  // Prefer the id GoTrue reports; fall back to the token subject. They agree in
  // practice, and disagreeing would mean the response was not ours to trust.
  const learnerId = body.user?.id ?? learnerIdFromToken(accessToken);

  return {
    accessToken,
    refreshToken,
    expiresAt: now + expiresIn * 1000,
    learnerId,
  };
}

async function post(
  config: AuthConfig,
  path: string,
  body: unknown,
  action: string,
): Promise<TokenResponse> {
  const doFetch = config.fetchImpl ?? fetch;
  const response = await doFetch(`${config.url.replace(/\/$/u, '')}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.publishableKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // A 422 here almost always means anonymous sign-ins are off in this
    // environment, which is a deployment mistake rather than a learner error.
    throw new AnonymousAuthError(
      `${action} failed: ${response.status} ${detail.slice(0, 200)}` +
        (response.status === 422
          ? ' (is enable_anonymous_sign_ins true in THIS environment?)'
          : ''),
    );
  }

  return (await response.json()) as TokenResponse;
}

/** Mint a brand-new anonymous learner. One call = one new UUID, so call it only when there is no session. */
export async function signInAnonymously(
  config: AuthConfig,
  now: number = Date.now(),
): Promise<AnonymousSession> {
  return toSession(await post(config, 'signup', {}, 'anonymous sign-in'), now);
}

export async function refreshSession(
  config: AuthConfig,
  refreshToken: string,
  now: number = Date.now(),
): Promise<AnonymousSession> {
  return toSession(
    await post(config, 'token?grant_type=refresh_token', { refresh_token: refreshToken }, 'token refresh'),
    now,
  );
}

/**
 * Refresh a little before the token actually expires. Without the skew, a token
 * that passes this check can still expire in flight and fail the request it was
 * fetched for.
 */
const EXPIRY_SKEW_MS = 60_000;

export function isExpired(session: Pick<AnonymousSession, 'expiresAt'>, now = Date.now()): boolean {
  return session.expiresAt - EXPIRY_SKEW_MS <= now;
}
