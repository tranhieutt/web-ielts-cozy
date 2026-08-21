// VOC-API-06 — learner totals + per-deck progress for the dashboard and the
// end-of-session summary. Per-session counters (reviewed/known in THIS session)
// belong to the session runner, not here.
import { NextResponse, type NextRequest } from 'next/server';

import { attachLearnerSession, resolveLearner } from '@/features/vocabulary/identity';
import { getRepository } from '@/features/vocabulary/repository.factory';
import { getLearnerProgress } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  const learner = await resolveLearner(request);
  const repository = getRepository({ accessToken: learner.accessToken });
  const progress = await getLearnerProgress(repository, learner.learnerId);
  const response = NextResponse.json(progress);
  return attachLearnerSession(response, learner);
}
