// VOC-API-03 — review queue. `due_at` is read here and nowhere else.
import { NextResponse, type NextRequest } from 'next/server';

import { withLearner } from '@/features/vocabulary/route-helpers';
import { ValidationError, parseQueueRequest } from '@/features/vocabulary/schema';
import { buildReviewQueue } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  return withLearner(request, async (session) => {
    try {
      const params = parseQueueRequest(request.nextUrl.searchParams);
      const cards = await buildReviewQueue(session, params);
      return NextResponse.json({ mode: params.mode, deck: params.deck, cards });
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  });
}
