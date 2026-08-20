/**
 * In-session Vocabulary review queue (spec §8.3).
 *
 * This queue is deliberately separate from `due_at`. `due_at` decides which
 * cards enter a NEW session; once a session is running the order lives only in
 * memory and is never re-derived from `due_at`. A card rated `again` therefore
 * comes back inside the same session even though its persisted due time is ten
 * minutes in the future.
 *
 * Like `transition.mjs`, this module has no clock, storage, or network
 * dependency: every function takes a state and returns a new frozen state.
 */

import { SRS_RATINGS } from './transition.mjs';

/**
 * @typedef {Readonly<{
 *   pending: readonly string[],
 *   reinsertCounts: Readonly<Record<string, number>>,
 *   ratedCount: number,
 *   reinsertedCount: number,
 * }>} SessionQueue
 */

/** A re-inserted card must sit behind at least this many other unrated cards. */
export const REINSERT_GAP = 3;

/** Cap per card per session, so a session cannot extend itself indefinitely. */
export const MAX_REINSERTS_PER_CARD = 2;

function freezeState({ pending, reinsertCounts, ratedCount, reinsertedCount }) {
  return Object.freeze({
    pending: Object.freeze([...pending]),
    reinsertCounts: Object.freeze({ ...reinsertCounts }),
    ratedCount,
    reinsertedCount,
  });
}

/**
 * Build the initial in-session queue from an already-ordered card id list.
 *
 * Ordering (overdue -> due -> learning, or CEFR for new cards) belongs to the
 * queue endpoint; this module preserves whatever order it is handed.
 *
 * @param {string[]} cardIds
 * @returns {SessionQueue}
 */
export function createSessionQueue(cardIds) {
  if (!Array.isArray(cardIds)) {
    throw new TypeError('cardIds must be an array of card ids');
  }

  const seen = new Set();
  for (const cardId of cardIds) {
    if (typeof cardId !== 'string' || cardId.length === 0) {
      throw new TypeError('every card id must be a non-empty string');
    }
    if (seen.has(cardId)) {
      throw new TypeError(`duplicate card id in session queue: ${cardId}`);
    }
    seen.add(cardId);
  }

  return freezeState({
    pending: cardIds,
    reinsertCounts: {},
    ratedCount: 0,
    reinsertedCount: 0,
  });
}

/**
 * Card the learner is currently looking at, or null when the session is done.
 * @param {SessionQueue} queue
 * @returns {string|null}
 */
export function currentCardId(queue) {
  return queue.pending.length > 0 ? queue.pending[0] : null;
}

/**
 * Cards still waiting for a rating in this session.
 * @param {SessionQueue} queue
 * @returns {number}
 */
export function remainingCount(queue) {
  return queue.pending.length;
}

/**
 * @param {SessionQueue} queue
 * @returns {boolean}
 */
export function isSessionComplete(queue) {
  return queue.pending.length === 0;
}

/**
 * Apply one rating to the head of the queue.
 *
 * `known` drops the card from the session. `again` re-inserts it behind
 * `REINSERT_GAP` other unrated cards, unless the tail is too short or the card
 * already used its `MAX_REINSERTS_PER_CARD` budget — in those cases it simply
 * waits for a later session via its persisted `due_at`.
 *
 * @param {SessionQueue} queue
 * @param {'again'|'known'} rating
 * @returns {{ queue: SessionQueue, cardId: string, reinserted: boolean, reinsertPosition: number|null }}
 */
export function rateCurrentCard(queue, rating) {
  if (rating !== SRS_RATINGS.AGAIN && rating !== SRS_RATINGS.KNOWN) {
    throw new TypeError(`Unsupported Vocabulary SRS rating: ${rating}`);
  }

  const cardId = currentCardId(queue);
  if (cardId === null) {
    throw new Error('cannot rate a card: the session queue is empty');
  }

  const pending = queue.pending.slice(1);
  const usedReinserts = queue.reinsertCounts[cardId] ?? 0;
  const reinsertCounts = { ...queue.reinsertCounts };

  const shouldReinsert =
    rating === SRS_RATINGS.AGAIN &&
    pending.length >= REINSERT_GAP &&
    usedReinserts < MAX_REINSERTS_PER_CARD;

  let reinsertPosition = null;
  if (shouldReinsert) {
    reinsertPosition = REINSERT_GAP;
    pending.splice(reinsertPosition, 0, cardId);
    reinsertCounts[cardId] = usedReinserts + 1;
  }

  return {
    queue: freezeState({
      pending,
      reinsertCounts,
      ratedCount: queue.ratedCount + 1,
      reinsertedCount: queue.reinsertedCount + (shouldReinsert ? 1 : 0),
    }),
    cardId,
    reinserted: shouldReinsert,
    reinsertPosition,
  };
}
