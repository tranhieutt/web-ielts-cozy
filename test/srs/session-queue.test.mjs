import assert from 'node:assert/strict';
import test from 'node:test';

import { SRS_RATINGS } from '../../apps/web/src/features/vocabulary/srs/transition.mjs';
import {
  MAX_REINSERTS_PER_CARD,
  REINSERT_GAP,
  createSessionQueue,
  currentCardId,
  isSessionComplete,
  rateCurrentCard,
  remainingCount,
} from '../../apps/web/src/features/vocabulary/srs/session-queue.mjs';

const deck = (n) => Array.from({ length: n }, (_, i) => `card-${i + 1}`);

test('known drops the card from the session queue', () => {
  const queue = createSessionQueue(deck(4));
  const result = rateCurrentCard(queue, SRS_RATINGS.KNOWN);

  assert.equal(result.cardId, 'card-1');
  assert.equal(result.reinserted, false);
  assert.deepEqual([...result.queue.pending], ['card-2', 'card-3', 'card-4']);
  assert.equal(result.queue.ratedCount, 1);
});

test('again re-inserts the card behind exactly 3 other unrated cards', () => {
  const queue = createSessionQueue(deck(5));
  const result = rateCurrentCard(queue, SRS_RATINGS.AGAIN);

  assert.equal(result.reinserted, true);
  assert.equal(result.reinsertPosition, REINSERT_GAP);
  assert.deepEqual([...result.queue.pending], ['card-2', 'card-3', 'card-4', 'card-1', 'card-5']);

  // VOC-06b: the card returns only after >= 3 other cards were shown.
  let next = result.queue;
  const shown = [];
  for (let i = 0; i < REINSERT_GAP; i += 1) {
    shown.push(currentCardId(next));
    next = rateCurrentCard(next, SRS_RATINGS.KNOWN).queue;
  }
  assert.deepEqual(shown, ['card-2', 'card-3', 'card-4']);
  assert.equal(currentCardId(next), 'card-1');
});

test('again does not re-insert when fewer than 3 unrated cards remain', () => {
  const queue = createSessionQueue(deck(REINSERT_GAP)); // 2 cards left after the head
  const result = rateCurrentCard(queue, SRS_RATINGS.AGAIN);

  assert.equal(result.reinserted, false);
  assert.equal(result.reinsertPosition, null);
  assert.deepEqual([...result.queue.pending], ['card-2', 'card-3']);
  assert.equal(result.queue.reinsertCounts['card-1'], undefined);
});

test('a card is re-inserted at most twice per session', () => {
  let queue = createSessionQueue(deck(12));
  const outcomes = [];

  // Rate card-1 `again` three times, walking it back to the head in between.
  for (let attempt = 0; attempt < MAX_REINSERTS_PER_CARD + 1; attempt += 1) {
    assert.equal(currentCardId(queue), 'card-1');
    const result = rateCurrentCard(queue, SRS_RATINGS.AGAIN);
    outcomes.push(result.reinserted);
    queue = result.queue;

    if (!result.reinserted) break;
    while (currentCardId(queue) !== 'card-1') {
      queue = rateCurrentCard(queue, SRS_RATINGS.KNOWN).queue;
    }
  }

  assert.deepEqual(outcomes, [true, true, false], 'third again must not re-insert');
  assert.equal(queue.reinsertCounts['card-1'], MAX_REINSERTS_PER_CARD);
  assert.ok(!queue.pending.includes('card-1'), 'exhausted card waits for the next session');
});

test('the queue never reads due_at and always terminates', () => {
  let queue = createSessionQueue(deck(20));
  let guard = 0;

  while (!isSessionComplete(queue)) {
    guard += 1;
    assert.ok(guard <= 200, 'session queue must terminate');
    queue = rateCurrentCard(queue, SRS_RATINGS.AGAIN).queue;
  }

  // 20 cards, each re-inserted at most twice, minus the tail cards that are
  // too close to the end to be re-inserted at all.
  assert.equal(remainingCount(queue), 0);
  assert.ok(queue.ratedCount > 20);
  assert.ok(queue.ratedCount <= 20 * (1 + MAX_REINSERTS_PER_CARD));
});

test('rejects invalid queues and ratings without mutating state', () => {
  assert.throws(() => createSessionQueue('card-1'), /must be an array/);
  assert.throws(() => createSessionQueue(['a', 'a']), /duplicate card id/);
  assert.throws(() => createSessionQueue(['']), /non-empty string/);

  const queue = createSessionQueue(deck(3));
  assert.throws(() => rateCurrentCard(queue, 'hard'), /Unsupported Vocabulary SRS rating/);
  assert.deepEqual([...queue.pending], deck(3), 'input queue must not be mutated');

  assert.throws(() => rateCurrentCard(createSessionQueue([]), SRS_RATINGS.KNOWN), /queue is empty/);
});
