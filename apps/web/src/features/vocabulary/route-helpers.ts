/**
 * Shared route plumbing for the vocabulary endpoints (VOC-API-01).
 *
 * Every endpoint needs the same three things: resolve the learner, run the
 * handler, write back a rotated session. Centralising it means a route cannot
 * forget `attachLearnerSession` and silently mint a new learner on every
 * request — which would look like progress vanishing.
 */

import { NextResponse, type NextRequest } from 'next/server';

import {
  AuthRateLimitError,
  attachLearnerSession,
  resolveLearnerSession,
  type LearnerSession,
} from './identity.ts';

/**
 * ADR-004 requires an explicit human message when the anonymous sign-in quota
 * is hit, never a blank or broken screen. 503 + Retry-After, because the
 * learner did nothing wrong and the condition clears on its own.
 */
function rateLimited(): NextResponse {
  return NextResponse.json(
    {
      error: 'auth_rate_limited',
      message:
        'Mạng của bạn đang có quá nhiều người dùng mới. Vui lòng thử lại sau ít phút.',
    },
    { status: 503, headers: { 'Retry-After': '300' } },
  );
}

export async function withLearner(
  request: NextRequest,
  handler: (session: LearnerSession) => Promise<NextResponse>,
): Promise<NextResponse> {
  let session: LearnerSession;
  try {
    session = await resolveLearnerSession(request);
  } catch (error) {
    if (error instanceof AuthRateLimitError) return rateLimited();
    throw error;
  }

  return attachLearnerSession(await handler(session), session);
}
