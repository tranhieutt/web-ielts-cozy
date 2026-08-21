// VOC-WEB-10 / ADR-004 — a learner deletes their own study data.
import { NextResponse, type NextRequest } from 'next/server';

import { attachLearnerSession, resolveLearner } from '@/features/vocabulary/identity';
import { deleteLearnerData } from '@/features/vocabulary/learner-data';

export async function DELETE(request: NextRequest) {
  const learner = await resolveLearner(request);

  // No id in the body or the URL on purpose: the row owner comes from the
  // session, so there is no parameter a caller could point at someone else.
  // A brand-new visitor with nothing stored gets a successful no-op rather than
  // an error — the outcome they asked for is already true.
  const result = await deleteLearnerData({ accessToken: learner.accessToken });

  const response = NextResponse.json(result);
  return attachLearnerSession(response, learner);
}
