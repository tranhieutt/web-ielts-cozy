/**
 * Learner identity (`VOC-API-01`).
 *
 * D-12: `learner_id` IS the Supabase Anonymous Auth UUID. Signing in later
 * links an identity to that same UUID, so no row is ever migrated (ADR-004).
 *
 * Two modes, chosen by the same `VOCABULARY_DATA_SOURCE` switch the repository
 * uses, because identity and storage have to agree:
 *
 * - `supabase`: a real anonymous session. Tokens live in httpOnly cookies and
 *   every request carries the learner's access token, so RLS — not this file —
 *   decides what they can see.
 * - `fixture`: an unsigned UUID cookie. It proves nothing and guards nothing,
 *   which is fine only because fixture data is fake and per-process.
 *
 * The fixture path must never be used against real learner data. The factory
 * enforces that from the other side: `supabase` refuses to run without a token.
 */

import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

import {
  type AnonymousSession,
  isExpired,
  refreshSession,
  signInAnonymously,
} from './auth/anonymous.ts';
import { resolveDataSource } from './repository.factory.ts';

/** Unsigned id for fixture mode only. */
export const LEARNER_COOKIE = 'ielts_cozy_slice_learner';
export const ACCESS_COOKIE = 'ielts_cozy_at';
export const REFRESH_COOKIE = 'ielts_cozy_rt';

export interface ResolvedLearner {
  learnerId: string;
  isNew: boolean;
  /** Present in `supabase` mode only; the Supabase adapter requires it. */
  accessToken?: string;
  /** Set when a session was minted or refreshed and must be written to cookies. */
  session?: AnonymousSession;
}

function authConfig(env: NodeJS.ProcessEnv) {
  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error('anonymous auth requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY');
  }
  return { url, publishableKey };
}

export async function resolveLearner(
  request: NextRequest,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ResolvedLearner> {
  if (resolveDataSource(env) === 'fixture') {
    const existing = request.cookies.get(LEARNER_COOKIE)?.value;
    if (existing) return { learnerId: existing, isNew: false };
    return { learnerId: randomUUID(), isNew: true };
  }

  const config = authConfig(env);
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  // The expiry is re-derived from the token rather than trusted from a cookie,
  // so a tampered expiry cannot keep a dead token in circulation.
  if (accessToken) {
    const claims = readClaims(accessToken);
    if (claims && !isExpired({ expiresAt: claims.expiresAt })) {
      return { learnerId: claims.learnerId, isNew: false, accessToken };
    }
  }

  if (refreshToken) {
    try {
      const session = await refreshSession(config, refreshToken);
      return {
        learnerId: session.learnerId,
        isNew: false,
        accessToken: session.accessToken,
        session,
      };
    } catch {
      // A refresh token that no longer works means the session is gone — for
      // example the user was cleaned up by the 3-month retention job. Falling
      // through mints a NEW learner, which loses progress; that is the accepted
      // consequence in ADR-004, not a bug to paper over here.
    }
  }

  const session = await signInAnonymously(config);
  return {
    learnerId: session.learnerId,
    isNew: true,
    accessToken: session.accessToken,
    session,
  };
}

function readClaims(accessToken: string): { learnerId: string; expiresAt: number } | null {
  const segments = accessToken.split('.');
  if (segments.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(segments[1], 'base64url').toString('utf8')) as {
      sub?: string;
      exp?: number;
    };
    if (!payload.sub || !payload.exp) return null;
    return { learnerId: payload.sub, expiresAt: payload.exp * 1000 };
  } catch {
    return null;
  }
}

interface CookieOptions {
  name: string;
  value: string;
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
}

type CookieSink = { cookies: { set: (options: CookieOptions) => unknown } };

function setCookie(response: CookieSink, name: string, value: string, maxAge: number): void {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    sameSite: 'lax',
    // Tokens must not travel over plaintext outside local development.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // ADR-004: 3-month retention.

/**
 * Persist whatever identity this request established. Called on every response
 * so a refreshed token is not thrown away.
 */
export function attachLearnerSession<T extends CookieSink>(
  response: T,
  learner: ResolvedLearner,
): T {
  if (learner.session) {
    const accessMaxAge = Math.max(
      1,
      Math.floor((learner.session.expiresAt - Date.now()) / 1000),
    );
    setCookie(response, ACCESS_COOKIE, learner.session.accessToken, accessMaxAge);
    setCookie(response, REFRESH_COOKIE, learner.session.refreshToken, REFRESH_MAX_AGE_SECONDS);
    return response;
  }

  if (!learner.accessToken) {
    setCookie(response, LEARNER_COOKIE, learner.learnerId, 60 * 60 * 24 * 30);
  }

  return response;
}
