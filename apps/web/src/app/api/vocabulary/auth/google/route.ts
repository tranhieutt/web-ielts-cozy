/**
 * VOC-API-01 — start Google identity linking.
 *
 * The learner already has an anonymous UUID by the time they reach here (every
 * vocabulary request mints one). This endpoint attaches Google to THAT user
 * rather than signing into a new one, so no progress moves.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { buildGoogleLinkUrl } from '@/features/vocabulary/auth.supabase';
import {
  attachLearnerSession,
  attachPkceVerifier,
  createPkcePair,
  resolveLearnerSession,
} from '@/features/vocabulary/identity';

export async function GET(request: NextRequest) {
  const session = await resolveLearnerSession(request);

  // Placeholder identities are not real users, so there is nothing to link to.
  if (!session.accessToken) {
    return NextResponse.json(
      { error: 'auth_not_configured', message: 'Đăng nhập chưa khả dụng.' },
      { status: 503 },
    );
  }

  const { verifier, challenge } = createPkcePair();
  const callback = new URL('/api/vocabulary/auth/callback', request.nextUrl.origin);
  const googleUrl = await buildGoogleLinkUrl(session.accessToken, callback.toString(), challenge);

  // The session must be written back here, not only in the callback. Resolving
  // may have rotated the refresh token, and Supabase invalidates the old one
  // moments later. If the learner then cancels on Google's screen, the browser
  // would be holding credentials that no longer work, the next request would
  // mint a fresh anonymous UUID, and their progress would be stranded — the
  // exact failure this flow exists to prevent.
  const response = attachPkceVerifier(NextResponse.redirect(googleUrl), verifier);
  return attachLearnerSession(response, session);
}
