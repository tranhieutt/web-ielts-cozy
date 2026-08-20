/**
 * VOC-API-01 — finish Google identity linking.
 *
 * Google sends the learner back through Supabase to here with `?code=`. The
 * code is exchanged server-side (PKCE) so no token ever appears in a URL the
 * browser keeps in history.
 */
import { NextResponse, type NextRequest } from 'next/server';

import { exchangeCodeForSession } from '@/features/vocabulary/auth.supabase';
import {
  attachLinkedSession,
  clearPkceVerifier,
  readPkceVerifier,
} from '@/features/vocabulary/identity';

/** Never send the learner into a dead end; land them back on the catalog. */
function backToVocabulary(request: NextRequest, reason?: string): NextResponse {
  const target = new URL('/vocabulary', request.nextUrl.origin);
  if (reason) target.searchParams.set('signin', reason);
  return clearPkceVerifier(NextResponse.redirect(target));
}

export async function GET(request: NextRequest) {
  // The learner declined on Google's screen, or Google refused. Not an error.
  if (request.nextUrl.searchParams.get('error')) {
    return backToVocabulary(request, 'cancelled');
  }

  const code = request.nextUrl.searchParams.get('code');
  const verifier = readPkceVerifier(request);
  if (!code || !verifier) return backToVocabulary(request, 'failed');

  try {
    const tokens = await exchangeCodeForSession(code, verifier);
    return attachLinkedSession(backToVocabulary(request, 'linked'), tokens);
  } catch {
    return backToVocabulary(request, 'failed');
  }
}
