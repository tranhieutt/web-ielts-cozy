/**
 * Learner-state source selector.
 *
 * Mirrors `content.ts`, but the choice is made per REQUEST rather than per
 * process: a learner carrying a real access token gets durable Supabase state,
 * and only a request with no token at all falls back to the in-memory fixture.
 *
 * Tying the fallback to the token — not to an env flag — means the insecure
 * path cannot be selected by accident in front of a real database. No token
 * means no `auth.uid()`, which means RLS would reject every write anyway.
 */

import * as supabase from './learner.supabase.ts';
export { StaleStateError } from './learner.supabase.ts';
import * as fixture from './repository.fixture.ts';
import { STAGE_INTERVAL_MINUTES } from './srs/transition.mjs';
import type { LearnerCardState, Rating, ReviewResult } from './types.ts';

/**
 * Who is acting, and with what credential.
 *
 * `accessToken` is null only for the fixture path. The service passes this
 * around instead of a bare id because acting as a learner genuinely requires
 * both — an id alone cannot satisfy RLS.
 */
export interface LearnerContext {
  learnerId: string;
  accessToken: string | null;
}

/** The DB constrains `next_stage` to 0..6, so an out-of-range value is a bug, not input. */
function stageInterval(stage: number): number {
  const interval = (STAGE_INTERVAL_MINUTES as Record<number, number | undefined>)[stage];
  if (interval === undefined) throw new Error(`no SRS interval for stage ${stage}`);
  return interval;
}

export async function getLearnerStates(ctx: LearnerContext): Promise<LearnerCardState[]> {
  if (ctx.accessToken) return supabase.getLearnerStates(ctx.learnerId, ctx.accessToken);
  return fixture.getLearnerStates(ctx.learnerId);
}

export interface SubmitInput {
  cardId: string;
  rating: Rating;
  idempotencyKey: string;
  reviewedAt: Date;
  /** The state the transition was computed from, for the RPC's staleness check. */
  expected: { state: string; stage: number | null };
  next: { state: string; stage: number; dueAt: string; intervalMinutes: number };
}

/**
 * Persist one review.
 *
 * Supabase path: a single RPC call is a single transaction, and the unique
 * `(learner_id, idempotency_key)` constraint — not application code — is what
 * makes a retry safe.
 *
 * Fixture path: the same contract emulated in two maps, which is why it is only
 * ever a development convenience.
 */
export async function submitReview(
  ctx: LearnerContext,
  input: SubmitInput,
): Promise<ReviewResult> {
  if (ctx.accessToken) {
    const row = await supabase.submitReview(ctx.accessToken, {
      cardId: input.cardId,
      rating: input.rating,
      idempotencyKey: input.idempotencyKey,
      reviewedAt: input.reviewedAt.toISOString(),
      expectedState: input.expected.state,
      expectedStage: input.expected.stage,
      nextState: input.next.state,
      nextStage: input.next.stage,
      nextDueAt: input.next.dueAt,
    });

    return {
      cardId: row.result_card_id,
      state: row.result_state,
      stage: row.result_stage,
      dueAt: row.result_due_at,
      // Derived rather than stored: the interval is a pure function of the
      // stage (spec table 8.1), so persisting it would create a second copy
      // that could disagree with the schedule.
      intervalMinutes: stageInterval(row.result_stage),
      replayed: row.replayed,
    };
  }

  const replay = fixture.findReplay(ctx.learnerId, input.idempotencyKey);
  if (replay !== undefined) {
    return { ...(JSON.parse(replay) as ReviewResult), replayed: true };
  }

  const current =
    fixture.getLearnerState(ctx.learnerId, input.cardId) ??
    ({
      learnerId: ctx.learnerId,
      cardId: input.cardId,
      state: 'new',
      stage: null,
      dueAt: null,
      firstSeenAt: null,
      lastReviewedAt: null,
      reviewCount: 0,
    } satisfies LearnerCardState);

  const reviewedAtIso = input.reviewedAt.toISOString();
  fixture.putLearnerState({
    ...current,
    state: input.next.state as LearnerCardState['state'],
    stage: input.next.stage,
    dueAt: input.next.dueAt,
    firstSeenAt: current.firstSeenAt ?? reviewedAtIso,
    lastReviewedAt: reviewedAtIso,
    reviewCount: current.reviewCount + 1,
  });

  const result: ReviewResult = {
    cardId: input.cardId,
    state: input.next.state as ReviewResult['state'],
    stage: input.next.stage,
    dueAt: input.next.dueAt,
    intervalMinutes: input.next.intervalMinutes,
    replayed: false,
  };
  fixture.recordReview(
    ctx.learnerId,
    input.idempotencyKey,
    JSON.stringify({ ...result, replayed: false }),
  );
  return result;
}
