// VOC-API-06 — learner totals + per-deck progress for the dashboard and the
// end-of-session summary. Per-session counters (reviewed/known in THIS session)
// belong to the session runner, not here.
import { NextResponse, type NextRequest } from 'next/server';

import { withLearner } from '@/features/vocabulary/route-helpers';
import { getLearnerProgress } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  return withLearner(request, async (session) =>
    // `signedIn` comes from the session, not the data layer: whether an account
    // is linked is a property of the credential, not of the learner's progress.
    NextResponse.json({ ...(await getLearnerProgress(session)), signedIn: session.signedIn }),
  );
}
