/**
 * Learner identity (VOC-API-01).
 *
 * D-12/ADR-004: `learner_id` IS the Supabase Anonymous Auth UUID. There is no
 * `guest_identities` table and no separate `guest_id`. Signing in with Google
 * later links onto the same UUID, so progress never migrates.
 *
 * Two modes, chosen by whether Supabase auth is configured:
 *
 * - **Configured** (production, and dev pointed at the project): a real
 *   anonymous sign-in mints a UUID in `auth.users`. The session travels in
 *   httpOnly cookies and every learner-data call carries the access token, so
 *   RLS — not this module — is what enforces isolation.
 * - **Not configured** (tests, offline dev): an unsigned cookie UUID. This
 *   proves nothing about the caller and is only safe because that mode has no
 *   durable learner data at all; the fixture repository lives in process
 *   memory. It must never be the path in front of a real database.
 *
 * Cookie lifetime matches the 30-day retention in ADR-004: a learner whose
 * cookie outlives their user row would otherwise present a valid-looking
 * session for an identity that no longer exists.
 */

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

import {
  AuthRateLimitError,
  isConfigured,
  isExpired,
  readClaims,
  refreshSession,
  signInAnonymously,
} from './auth.supabase.ts';

export { AuthRateLimitError };

const ACCESS_COOKIE = 'ielts_cozy_at';
const REFRESH_COOKIE = 'ielts_cozy_rt';
/** Legacy slice cookie (pre-VOC-API-01). Read for continuity, never written. */
const PLACEHOLDER_COOKIE = 'ielts_cozy_slice_learner';

const RETENTION_DAYS = 30;
const COOKIE_MAX_AGE = 60 * 60 * 24 * RETENTION_DAYS;

export interface LearnerSession {
  learnerId: string;
  /**
   * Bearer token for learner-scoped Supabase calls, or `null` in placeholder
   * mode. `VOC-API-05s` passes this to PostgREST so writes land under the
   * learner's own RLS policy.
   */
  accessToken: string | null;
  refreshToken: string | null;
  /** True when cookies changed and must be written back onto the response. */
  rotated: boolean;
  /**
   * Whether a real account is linked. Drives the header affordance ADR-004
   * promises: an anonymous learner is shown how to keep their progress, and one
   * who already did is not nagged.
   */
  signedIn: boolean;
}

function cookieOptions(name: string, value: string) {
  return {
    name,
    value,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  };
}

/**
 * Resolve the learner for this request, minting one if needed.
 *
 * Order matters: reuse a live access token, else refresh, else sign in fresh.
 * A refresh that fails is not an error the learner can act on — the refresh
 * token was rotated away, revoked, or its user was deleted by the retention
 * job — so we mint a new anonymous learner rather than showing a dead end. That
 * loses prior progress, which is exactly the device/retention boundary ADR-004
 * discloses to the learner up front.
 */
export async function resolveLearnerSession(request: NextRequest): Promise<LearnerSession> {
  if (!isConfigured()) return placeholderSession(request);

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (accessToken && refreshToken) {
    const claims = readClaims(accessToken);
    if (claims && !isExpired(claims.exp)) {
      return {
        learnerId: claims.sub,
        accessToken,
        refreshToken,
        rotated: false,
        signedIn: !claims.isAnonymous,
      };
    }
  }

  if (refreshToken) {
    try {
      const pair = await refreshSession(refreshToken);
      return { ...pair, rotated: true, signedIn: !readClaims(pair.accessToken)?.isAnonymous };
    } catch (error) {
      // Rate limiting is a real, reportable condition; a dead refresh token is not.
      if (error instanceof AuthRateLimitError) throw error;
    }
  }

  const pair = await signInAnonymously();
  return { ...pair, rotated: true, signedIn: false };
}

/** Dev/test identity. Unsigned, unauthenticated, and never in front of real data. */
function placeholderSession(request: NextRequest): LearnerSession {
  const existing = request.cookies.get(PLACEHOLDER_COOKIE)?.value;
  return {
    learnerId: existing ?? randomUUID(),
    accessToken: null,
    refreshToken: null,
    rotated: existing === undefined,
    signedIn: false,
  };
}

/** Persist a rotated session. A no-op when nothing changed, to keep responses cacheable. */
export function attachLearnerSession<T extends NextResponse>(
  response: T,
  session: LearnerSession,
): T {
  if (!session.rotated) return response;

  if (session.accessToken && session.refreshToken) {
    response.cookies.set(cookieOptions(ACCESS_COOKIE, session.accessToken));
    response.cookies.set(cookieOptions(REFRESH_COOKIE, session.refreshToken));
    // A real session supersedes the placeholder; leaving it would let a later
    // config change silently resurrect a different learner id.
    response.cookies.delete(PLACEHOLDER_COOKIE);
    return response;
  }

  response.cookies.set(cookieOptions(PLACEHOLDER_COOKIE, session.learnerId));
  return response;
}

/* ------------------------------------------------------------------ *
 * Google identity linking (VOC-API-01)
 * ------------------------------------------------------------------ */

const VERIFIER_COOKIE = 'ielts_cozy_pkce';
/** The verifier only has to survive one round trip to Google. */
const VERIFIER_MAX_AGE = 60 * 10;

export interface PkcePair {
  verifier: string;
  challenge: string;
}

/** RFC 7636 S256. The verifier stays server-side; only its hash reaches Google. */
export function createPkcePair(): PkcePair {
  const verifier = randomBytes(48).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function attachPkceVerifier<T extends NextResponse>(response: T, verifier: string): T {
  response.cookies.set({
    ...cookieOptions(VERIFIER_COOKIE, verifier),
    maxAge: VERIFIER_MAX_AGE,
  });
  return response;
}

export function readPkceVerifier(request: NextRequest): string | undefined {
  return request.cookies.get(VERIFIER_COOKIE)?.value;
}

/** Single-use by design: leaving it set would let a stale code be replayed. */
export function clearPkceVerifier<T extends NextResponse>(response: T): T {
  response.cookies.delete(VERIFIER_COOKIE);
  return response;
}

/**
 * Persist the session produced by linking.
 *
 * Unconditional, unlike `attachLearnerSession`: the linked session always
 * supersedes the anonymous one, even though the learner id is unchanged.
 */
export function attachLinkedSession<T extends NextResponse>(
  response: T,
  tokens: { accessToken: string; refreshToken: string },
): T {
  response.cookies.set(cookieOptions(ACCESS_COOKIE, tokens.accessToken));
  response.cookies.set(cookieOptions(REFRESH_COOKIE, tokens.refreshToken));
  return response;
}
