// VOC-API-02 — deck catalog. Returns summaries only, never the corpus.
import { NextResponse, type NextRequest } from 'next/server';

import { attachLearnerSession, resolveLearner } from '@/features/vocabulary/identity';
import { getRepository } from '@/features/vocabulary/repository.factory';
import { getDeckCatalog } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  const learner = await resolveLearner(request);
  const repository = getRepository({ accessToken: learner.accessToken });
  const decks = await getDeckCatalog(repository, learner.learnerId);
  const response = NextResponse.json({ decks });
  return attachLearnerSession(response, learner);
}
