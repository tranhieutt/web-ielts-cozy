/**
 * Deterministic two-rating SRS policy for Vocabulary MVP.
 *
 * This module deliberately has no database or clock dependency. The caller
 * provides the persisted state, rating, and review timestamp; persistence and
 * idempotency belong to the review endpoint transaction.
 */

export const SRS_RATINGS = Object.freeze({
  AGAIN: 'again',
  KNOWN: 'known',
});

export const STAGE_INTERVAL_MINUTES = Object.freeze({
  0: 10,
  1: 24 * 60,
  2: 3 * 24 * 60,
  3: 7 * 24 * 60,
  4: 14 * 24 * 60,
  5: 30 * 24 * 60,
  6: 60 * 24 * 60,
});

const STATE_STAGE_KEYS = new Map([
  ['new', 'new'],
  ['learning:0', 'learning:0'],
  ['review:1', 'review:1'],
  ['review:2', 'review:2'],
  ['review:3', 'review:3'],
  ['review:4', 'review:4'],
  ['review:5', 'review:5'],
  ['mastered:6', 'mastered:6'],
]);

const TRANSITIONS = Object.freeze({
  new: {
    [SRS_RATINGS.AGAIN]: { state: 'learning', stage: 0 },
    [SRS_RATINGS.KNOWN]: { state: 'review', stage: 1 },
  },
  'learning:0': {
    [SRS_RATINGS.AGAIN]: { state: 'learning', stage: 0 },
    [SRS_RATINGS.KNOWN]: { state: 'review', stage: 1 },
  },
  'review:1': {
    [SRS_RATINGS.AGAIN]: { state: 'learning', stage: 0 },
    [SRS_RATINGS.KNOWN]: { state: 'review', stage: 2 },
  },
  'review:2': {
    [SRS_RATINGS.AGAIN]: { state: 'review', stage: 1 },
    [SRS_RATINGS.KNOWN]: { state: 'review', stage: 3 },
  },
  'review:3': {
    [SRS_RATINGS.AGAIN]: { state: 'review', stage: 2 },
    [SRS_RATINGS.KNOWN]: { state: 'review', stage: 4 },
  },
  'review:4': {
    [SRS_RATINGS.AGAIN]: { state: 'review', stage: 3 },
    [SRS_RATINGS.KNOWN]: { state: 'review', stage: 5 },
  },
  'review:5': {
    [SRS_RATINGS.AGAIN]: { state: 'review', stage: 4 },
    [SRS_RATINGS.KNOWN]: { state: 'mastered', stage: 6 },
  },
  'mastered:6': {
    [SRS_RATINGS.AGAIN]: { state: 'review', stage: 5 },
    [SRS_RATINGS.KNOWN]: { state: 'mastered', stage: 6 },
  },
});

function stateStageKey({ state, stage }) {
  if (state === 'new' && (stage === null || stage === undefined)) {
    return 'new';
  }

  const key = `${state}:${stage}`;
  if (!STATE_STAGE_KEYS.has(key)) {
    throw new TypeError(`Invalid Vocabulary SRS state/stage: ${state}:${stage}`);
  }

  return key;
}

function normalizeReviewedAt(reviewedAt) {
  const value = reviewedAt instanceof Date ? reviewedAt : new Date(reviewedAt);
  if (Number.isNaN(value.getTime())) {
    throw new TypeError('reviewedAt must be a valid UTC timestamp');
  }

  return value;
}

/**
 * Calculate next state and due time from one Vocabulary review rating.
 *
 * @param {{ state: 'new'|'learning'|'review'|'mastered', stage?: number|null }} current
 * @param {'again'|'known'} rating
 * @param {Date|string|number} reviewedAt
 * @returns {{ state: string, stage: number, dueAt: string, intervalMinutes: number }}
 */
export function transitionVocabularySrs(current, rating, reviewedAt) {
  if (!current || typeof current !== 'object') {
    throw new TypeError('current state is required');
  }
  if (rating !== SRS_RATINGS.AGAIN && rating !== SRS_RATINGS.KNOWN) {
    throw new TypeError(`Unsupported Vocabulary SRS rating: ${rating}`);
  }

  const key = stateStageKey(current);
  const next = TRANSITIONS[key][rating];
  const intervalMinutes = STAGE_INTERVAL_MINUTES[next.stage];
  const reviewTime = normalizeReviewedAt(reviewedAt);
  const dueAt = new Date(reviewTime.getTime() + intervalMinutes * 60_000);

  return {
    state: next.state,
    stage: next.stage,
    dueAt: dueAt.toISOString(),
    intervalMinutes,
  };
}
