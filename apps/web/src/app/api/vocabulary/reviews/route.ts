// VOC-API-05 — submit one review. Idempotent by `idempotencyKey`.
import { NextResponse, type NextRequest } from 'next/server';

import { withLearner } from '@/features/vocabulary/route-helpers';
import { ValidationError, parseReviewRequest } from '@/features/vocabulary/schema';
import { submitReview } from '@/features/vocabulary/service';

export async function POST(request: NextRequest) {
  return withLearner(request, async (session) => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'request body must be valid JSON' }, { status: 400 });
    }

    try {
      const parsed = parseReviewRequest(body);
      return NextResponse.json(await submitReview(session, parsed));
    } catch (error) {
      if (error instanceof ValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof Error && error.message.startsWith('unknown card')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      throw error;
    }
  });
}
