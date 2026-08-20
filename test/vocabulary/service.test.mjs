/**
 * Vertical-slice service tests (VOC-API-02/03/05 on fixture data).
 *
 * These run the TypeScript service through Node's type stripping, so they
 * exercise the same code the route handlers import.
 */
import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';

import * as repository from '../../apps/web/src/features/vocabulary/repository.fixture.ts';
import {
  buildReviewQueue,
  getDeckCatalog,
  getLearnerProgress,
  submitReview,
} from '../../apps/web/src/features/vocabulary/service.ts';

const LEARNER = '11111111-1111-4111-8111-111111111111';
const OTHER_LEARNER = '22222222-2222-4222-8222-222222222222';
const KEY = () => crypto.randomUUID();

beforeEach(() => repository.resetFixtureState());

test('deck catalog reports publishable counts without shipping the corpus', () => {
  const [deck] = getDeckCatalog(LEARNER);

  assert.equal(deck.slug, 'environment');
  assert.equal(deck.displayNameVi, 'Môi trường');
  assert.equal(deck.publishableCardCount, 20);
  assert.equal(deck.dueCount, 0);
  assert.equal(deck.progress.newCount, 20);
  assert.ok(!('cards' in deck), 'catalog must not embed card content');
});

test('new mode returns unseen cards easiest-CEFR first and respects the limit', () => {
  const cards = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 5 });

  assert.equal(cards.length, 5);
  const ranks = cards.map((card) => card.cefr ?? 'ZZ');
  assert.deepEqual([...ranks].sort(), ranks, `expected non-decreasing CEFR, got ${ranks}`);
});

test('a rated card leaves the new queue and comes back only when due', () => {
  const [first] = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 1 });

  const past = new Date(Date.now() - 60 * 60 * 1000);
  submitReview(LEARNER, { cardId: first.id, rating: 'again', idempotencyKey: KEY(), reviewedAt: past });

  const stillNew = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 20 });
  assert.ok(!stillNew.some((card) => card.id === first.id), 'seen card must leave the new queue');

  const due = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'due', limit: 20 });
  assert.deepEqual(due.map((card) => card.id), [first.id]);
});

test('a card scheduled into the future is not in the due queue', () => {
  const [first] = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 1 });
  submitReview(LEARNER, { cardId: first.id, rating: 'known', idempotencyKey: KEY() });

  const due = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'due', limit: 20 });
  assert.deepEqual(due, [], 'a +1 day card must wait for a later session');
});

test('replaying an idempotency key returns the first result, not a second stage', () => {
  const [card] = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 1 });
  const key = KEY();

  const first = submitReview(LEARNER, { cardId: card.id, rating: 'known', idempotencyKey: key });
  const replay = submitReview(LEARNER, { cardId: card.id, rating: 'known', idempotencyKey: key });

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.stage, first.stage, 'replay must not advance the stage');
  assert.equal(replay.dueAt, first.dueAt);

  const advanced = submitReview(LEARNER, { cardId: card.id, rating: 'known', idempotencyKey: KEY() });
  assert.equal(advanced.stage, first.stage + 1, 'a genuinely new review still advances');
});

test('learner progress does not leak between learners', () => {
  const [card] = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 1 });
  submitReview(LEARNER, { cardId: card.id, rating: 'known', idempotencyKey: KEY() });

  const [otherDeck] = getDeckCatalog(OTHER_LEARNER);
  assert.equal(otherDeck.progress.newCount, 20);
  assert.equal(otherDeck.progress.learningCount, 0);

  const otherQueue = buildReviewQueue(OTHER_LEARNER, { deck: 'environment', mode: 'new', limit: 20 });
  assert.ok(otherQueue.some((c) => c.id === card.id), "other learner still sees the card as new");
});

test('unknown deck and unknown card are rejected rather than guessed', () => {
  assert.deepEqual(buildReviewQueue(LEARNER, { deck: 'no-such-deck', mode: 'new', limit: 5 }), []);
  assert.throws(
    () => submitReview(LEARNER, { cardId: 'w_missing', rating: 'known', idempotencyKey: KEY() }),
    /unknown card/,
  );
});

test('learner-facing payload carries no Chinese source text or Youdao audio', () => {
  const cards = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 20 });
  const payload = JSON.stringify(cards);

  assert.ok(!/def_zh|"zh"/.test(payload), 'no Chinese fields (VOC-08)');
  assert.ok(!/youdao/i.test(payload), 'no Youdao audio URLs');
  assert.ok(cards.every((card) => card.senses.every((sense) => sense.def_vi.length > 0)));
});

test('learner progress separates due from scheduled and never inflates mastery', () => {
  const cards = buildReviewQueue(LEARNER, { deck: 'environment', mode: 'new', limit: 3 });
  const past = new Date(Date.now() - 60 * 60 * 1000);

  // One card rated in the past -> due again now; two rated now -> scheduled.
  submitReview(LEARNER, { cardId: cards[0].id, rating: 'again', idempotencyKey: KEY(), reviewedAt: past });
  submitReview(LEARNER, { cardId: cards[1].id, rating: 'known', idempotencyKey: KEY() });
  submitReview(LEARNER, { cardId: cards[2].id, rating: 'known', idempotencyKey: KEY() });

  const progress = getLearnerProgress(LEARNER);

  assert.equal(progress.reviewedCount, 3);
  assert.equal(progress.dueCount, 1);
  assert.equal(progress.scheduledCount, 2);
  assert.equal(progress.learningCount, 3, 'rated cards are learning, not mastered');
  assert.equal(progress.masteredCount, 0, 'mastery requires stage 6, not a first correct answer');
  assert.equal(progress.decks[0].publishableCardCount, 20);
});

test('progress is empty for a learner who has rated nothing', () => {
  const progress = getLearnerProgress(OTHER_LEARNER);

  assert.equal(progress.reviewedCount, 0);
  assert.equal(progress.dueCount, 0);
  assert.equal(progress.scheduledCount, 0);
  assert.equal(progress.decks[0].progress.newCount, 20);
});
