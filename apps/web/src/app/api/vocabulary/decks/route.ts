// VOC-API-02 — deck catalog. Returns summaries only, never the corpus.
import { NextResponse, type NextRequest } from 'next/server';

import { attachLearnerCookie, resolveLearnerId } from '@/features/vocabulary/identity';
import { getDeckCatalog } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  const { learnerId } = resolveLearnerId(request);
  const response = NextResponse.json({ decks: getDeckCatalog(learnerId) });
  return attachLearnerCookie(response, learnerId);
}
