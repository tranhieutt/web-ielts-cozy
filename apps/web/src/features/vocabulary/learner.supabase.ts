/**
 * Supabase learner-state adapter (VOC-API-05s).
 *
 * This is what makes progress durable — VOC-07 — and it is the reason the
 * fixture adapter's "lost on restart" caveat finally stops applying.
 *
 * Every call carries the LEARNER's access token, never the publishable key on
 * its own and never the service-role key. That matters: isolation is enforced
 * by RLS against `auth.uid()`, so this module physically cannot read or write
 * another learner's rows even if it asked. A forged token yields no rows rather
 * than someone else's.
 *
 * Writes go through the `submit_vocabulary_review` RPC because the event and
 * the state update must be one transaction (spec §8.4); two PostgREST calls
 * could not be.
 */

import type { LearnerCardState } from './types.ts';

function config() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for learner state');
  }
  return { url, key };
}

/** Raised when the RPC rejects a card the learner cannot see. */
export class UnknownCardError extends Error {
  constructor(cardId: string) {
    super(`unknown card: ${cardId}`);
    this.name = 'UnknownCardError';
  }
}

async function rest<T>(
  accessToken: string,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    // Learner state is per-learner and changes on every review. Caching it
    // would serve one learner's progress to the next request.
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    if (body.includes('unknown card')) throw new UnknownCardError(path);
    throw new Error(`Supabase learner call failed (${response.status}): ${body}`);
  }
  return (await response.json()) as T;
}

interface StateRow {
  card_id: string;
  state: LearnerCardState['state'];
  stage: number | null;
  due_at: string | null;
  first_seen_at: string | null;
  last_reviewed_at: string | null;
  review_count: number;
}

function toState(learnerId: string, row: StateRow): LearnerCardState {
  return {
    learnerId,
    cardId: row.card_id,
    state: row.state,
    stage: row.stage,
    dueAt: row.due_at,
    firstSeenAt: row.first_seen_at,
    lastReviewedAt: row.last_reviewed_at,
    reviewCount: row.review_count,
  };
}

const STATE_COLUMNS =
  'card_id,state,stage,due_at,first_seen_at,last_reviewed_at,review_count';

/**
 * All states for the caller.
 *
 * No `learner_id` filter is sent, and that is not an oversight: RLS already
 * restricts the rows to `auth.uid()`. Adding a client-side filter would imply
 * the security boundary lives here, which it does not.
 */
export async function getLearnerStates(
  learnerId: string,
  accessToken: string,
): Promise<LearnerCardState[]> {
  const rows = await rest<StateRow[]>(
    accessToken,
    `learner_card_states?select=${STATE_COLUMNS}`,
  );
  return rows.map((row) => toState(learnerId, row));
}

export interface SubmitArgs {
  cardId: string;
  rating: 'again' | 'known';
  idempotencyKey: string;
  reviewedAt: string;
  nextState: string;
  nextStage: number;
  nextDueAt: string;
}

/**
 * Column names are prefixed because `RETURNS TABLE` declares them as plpgsql
 * variables; unprefixed `card_id`/`next_state` made every reference to the real
 * columns ambiguous (SQLSTATE 42702).
 */
export interface SubmitRow {
  result_card_id: string;
  result_state: LearnerCardState['state'];
  result_stage: number;
  result_due_at: string;
  replayed: boolean;
}

/** One transaction: review event + state update, idempotent by key. */
export async function submitReview(
  accessToken: string,
  args: SubmitArgs,
): Promise<SubmitRow> {
  const rows = await rest<SubmitRow[]>(accessToken, 'rpc/submit_vocabulary_review', {
    method: 'POST',
    body: JSON.stringify({
      p_card_id: args.cardId,
      p_rating: args.rating,
      p_idempotency_key: args.idempotencyKey,
      p_reviewed_at: args.reviewedAt,
      p_next_state: args.nextState,
      p_next_stage: args.nextStage,
      p_next_due_at: args.nextDueAt,
    }),
  });

  if (rows.length === 0) {
    throw new Error('submit_vocabulary_review returned no row');
  }
  return rows[0];
}
