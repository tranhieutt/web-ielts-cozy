// VOC-API-03 — review queue. `due_at` is read here and nowhere else.
import { NextResponse, type NextRequest } from 'next/server';

import { attachLearnerCookie, resolveLearnerId } from '@/features/vocabulary/identity';
import { ValidationError, parseQueueRequest } from '@/features/vocabulary/schema';
import { buildReviewQueue } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  const { learnerId } = resolveLearnerId(request);

  try {
    const params = parseQueueRequest(request.nextUrl.searchParams);
    const cards = buildReviewQueue(learnerId, params);
    const response = NextResponse.json({ mode: params.mode, deck: params.deck, cards });
    return attachLearnerCookie(response, learnerId);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
