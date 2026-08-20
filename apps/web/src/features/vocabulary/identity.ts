/**
 * Slice-only learner identity.
 *
 * D-12 says `learner_id` IS the Supabase Anonymous Auth UUID. That is blocked
 * on `VOC-INFRA-06` (`enable_anonymous_sign_ins` is still false), so the slice
 * uses a first-party cookie holding a UUID with the SAME shape.
 *
 * This is a placeholder, not an auth system: the cookie is unsigned, so it
 * proves nothing about who the caller is and must never guard real learner
 * data. `VOC-API-01` replaces this wholesale — no data migration is implied,
 * because nothing durable is stored against these ids.
 */

import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const LEARNER_COOKIE = 'ielts_cozy_slice_learner';

export function resolveLearnerId(request: NextRequest): { learnerId: string; isNew: boolean } {
  const existing = request.cookies.get(LEARNER_COOKIE)?.value;
  if (existing) return { learnerId: existing, isNew: false };
  return { learnerId: randomUUID(), isNew: true };
}

export function attachLearnerCookie<T extends { cookies: { set: (...args: never[]) => unknown } }>(
  response: T,
  learnerId: string,
): T {
  (response.cookies.set as unknown as (options: Record<string, unknown>) => void)({
    name: LEARNER_COOKIE,
    value: learnerId,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
