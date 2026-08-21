// VOC-API-05 — submit one review. Idempotent by `idempotencyKey`.
import { NextResponse, type NextRequest } from 'next/server';

import { attachLearnerSession, resolveLearner } from '@/features/vocabulary/identity';
import { getRepository } from '@/features/vocabulary/repository.factory';
import { StaleLearnerStateError, UnknownCardError } from '@/features/vocabulary/repository';
import { ValidationError, parseReviewRequest } from '@/features/vocabulary/schema';
import { submitReview } from '@/features/vocabulary/service';

export async function POST(request: NextRequest) {
  const learner = await resolveLearner(request);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'request body must be valid JSON' }, { status: 400 });
  }

  try {
    const parsed = parseReviewRequest(body);
    const repository = getRepository({ accessToken: learner.accessToken });
    const result = await submitReview(repository, learner.learnerId, parsed);
    const response = NextResponse.json(result);
    return attachLearnerSession(response, learner);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof UnknownCardError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof StaleLearnerStateError) {
      // 409, not 500: the request was well-formed and the learner did nothing
      // wrong — another session simply got there first. The client should
      // re-read the card rather than retry this exact body.
      return NextResponse.json(
        { error: 'thẻ này vừa được chấm ở phiên khác; hãy tải lại để tiếp tục' },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.message.startsWith('unknown card')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
