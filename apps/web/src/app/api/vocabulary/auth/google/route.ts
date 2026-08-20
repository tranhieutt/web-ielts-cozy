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

  return attachPkceVerifier(NextResponse.redirect(googleUrl), verifier);
}
