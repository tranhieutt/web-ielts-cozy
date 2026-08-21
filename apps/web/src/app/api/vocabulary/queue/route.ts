// VOC-API-03 — review queue. `due_at` is read here and nowhere else.
import { NextResponse, type NextRequest } from 'next/server';

import { attachLearnerSession, resolveLearner } from '@/features/vocabulary/identity';
import { getRepository } from '@/features/vocabulary/repository.factory';
import { ValidationError, parseQueueRequest } from '@/features/vocabulary/schema';
import { buildReviewQueue } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  const learner = await resolveLearner(request);

  try {
    const params = parseQueueRequest(request.nextUrl.searchParams);
    const repository = getRepository({ accessToken: learner.accessToken });
    const cards = await buildReviewQueue(repository, learner.learnerId, params);
    const response = NextResponse.json({ mode: params.mode, deck: params.deck, cards });
    return attachLearnerSession(response, learner);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
