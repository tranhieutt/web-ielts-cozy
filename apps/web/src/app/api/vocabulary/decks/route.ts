// VOC-API-02 — deck catalog. Returns summaries only, never the corpus.
import { NextResponse, type NextRequest } from 'next/server';

import { withLearner } from '@/features/vocabulary/route-helpers';
import { getDeckCatalog } from '@/features/vocabulary/service';

export async function GET(request: NextRequest) {
  return withLearner(request, async (session) =>
    NextResponse.json({ decks: await getDeckCatalog(session) }),
  );
}
