/**
 * VOC-QA-02 — review write against the real database.
 *
 * This is the test the stubbed adapter tests could not be: it proves the
 * properties that only Postgres can enforce — the write is one transaction,
 * a replay persists exactly one event, a stale write is refused, and RLS keeps
 * one learner out of another's rows.
 *
 * OPT-IN: skipped unless `VOCABULARY_INTEGRATION=1`. Ordinary `npm test` and CI
 * without credentials stay offline and fast, and nobody accidentally writes to
 * a real project by running the suite.
 *
 *   npm run vocab:test-integration
 *
 * Run it through that script, not by exporting the variable by hand: the
 * `VAR=1 cmd` form is bash-only and fails on PowerShell.
 *
 * CLEANUP: every anonymous learner this file creates is deleted at the end.
 * Deleting the auth user cascades to `learner_card_states` and
 * `learner_card_reviews`, so the project is left as it was found. If a run dies
 * mid-way the leftovers are anonymous users with a handful of rows, which the
 * ADR-004 retention job would eventually collect.
 */
import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import { signInAnonymously } from '../../apps/web/src/features/vocabulary/auth/anonymous.ts';
import {
  StaleLearnerStateError,
  UnknownCardError,
} from '../../apps/web/src/features/vocabulary/repository.ts';
import { createSupabaseRepository } from '../../apps/web/src/features/vocabulary/repository.supabase.ts';
import { deleteLearnerData } from '../../apps/web/src/features/vocabulary/learner-data.ts';
import { buildReviewQueue, submitReview } from '../../apps/web/src/features/vocabulary/service.ts';

const enabled = process.env.VOCABULARY_INTEGRATION === '1';
const skip = enabled ? false : 'set VOCABULARY_INTEGRATION=1 to run against a real project';

function env() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/u, '');
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error('SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY required');
  }
  return { url, publishableKey, serviceRoleKey };
}

const created = [];
let config;
let deckSlug = 'environment';

async function newLearner() {
  const session = await signInAnonymously({
    url: config.url,
    publishableKey: config.publishableKey,
  });
  created.push(session.learnerId);
  return {
    id: session.learnerId,
    accessToken: session.accessToken,
    repo: createSupabaseRepository({
      url: config.url,
      publishableKey: config.publishableKey,
      accessToken: session.accessToken,
    }),
  };
}

/** Counts a learner's own review events. Uses the LEARNER's token, so RLS applies. */
async function countReviews(learner, idempotencyKey) {
  const response = await fetch(
    `${config.url}/rest/v1/learner_card_reviews?select=id&idempotency_key=eq.${idempotencyKey}`,
    {
      headers: {
        apikey: config.publishableKey,
        authorization: `Bearer ${learner.accessToken}`,
        prefer: 'count=exact',
      },
    },
  );
  return (await response.json()).length;
}

const uuid = () => crypto.randomUUID();

before(async () => {
  if (!enabled) return;
  config = env();
});

after(async () => {
  if (!enabled) return;
  for (const id of created) {
    await fetch(`${config.url}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
      },
    }).catch(() => {});
  }
});

test('published content is reachable with nothing but an anonymous session', { skip }, async () => {
  const learner = await newLearner();
  const cards = await buildReviewQueue(learner.repo, learner.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 3,
  });

  assert.ok(cards.length > 0, 'a fresh learner must see published cards');
  assert.ok(
    cards.every((card) => card.senses.every((sense) => sense.def_vi.length > 0)),
    'every card must carry a Vietnamese definition (VOC-08)',
  );
});

test('one rating writes exactly one event and one state', { skip }, async () => {
  const learner = await newLearner();
  const [card] = await buildReviewQueue(learner.repo, learner.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 1,
  });
  const key = uuid();

  const result = await submitReview(learner.repo, learner.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: key,
  });

  assert.equal(result.replayed, false);
  assert.equal(await countReviews(learner, key), 1);

  const states = await learner.repo.getLearnerStates(learner.id);
  const state = states.find((entry) => entry.cardId === card.id);
  assert.ok(state, 'the state row must exist in the same breath as the event');
  assert.equal(state.reviewCount, 1);
  assert.equal(state.stage, result.stage);
});

test('a replayed key persists one event, not two', { skip }, async () => {
  const learner = await newLearner();
  const [card] = await buildReviewQueue(learner.repo, learner.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 1,
  });
  const key = uuid();

  const first = await submitReview(learner.repo, learner.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: key,
  });
  const replay = await submitReview(learner.repo, learner.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: key,
  });

  assert.equal(replay.replayed, true);
  assert.equal(replay.stage, first.stage, 'a replay must not advance the stage');
  assert.equal(await countReviews(learner, key), 1, 'the unique constraint must hold in the database');

  const states = await learner.repo.getLearnerStates(learner.id);
  const state = states.find((entry) => entry.cardId === card.id);
  assert.equal(state.reviewCount, 1, 'a replay must not inflate the review count either');
});

test('two writes computed from the same state: exactly one wins', { skip }, async () => {
  const learner = await newLearner();
  const [card] = await buildReviewQueue(learner.repo, learner.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 1,
  });

  // Both carry the SAME `expected`, which is what two tabs that read before
  // either wrote would send. Going through the adapter directly — rather than
  // through `submitReview`, which re-reads state per call — keeps this
  // deterministic: an earlier version raced the two READS and passed or failed
  // on network timing, proving nothing.
  const attempt = (dueOffsetDays) =>
    learner.repo.commitReview({
      learnerId: learner.id,
      cardId: card.id,
      rating: 'known',
      idempotencyKey: uuid(),
      reviewedAt: new Date(),
      expected: { state: 'new', stage: null },
      next: {
        state: 'review',
        stage: 1,
        dueAt: new Date(Date.now() + dueOffsetDays * 86_400_000).toISOString(),
      },
    });

  const outcomes = await Promise.allSettled([attempt(1), attempt(7)]);

  const won = outcomes.filter((o) => o.status === 'fulfilled');
  const lost = outcomes.filter((o) => o.status === 'rejected');

  assert.equal(won.length, 1, 'a second write from stale state must not be applied');
  assert.ok(
    lost[0].reason instanceof StaleLearnerStateError,
    `the loser must be a stale-state conflict, got ${lost[0].reason}`,
  );

  const states = await learner.repo.getLearnerStates(learner.id);
  const state = states.find((entry) => entry.cardId === card.id);
  assert.equal(state.reviewCount, 1, 'the losing write must leave nothing behind');
  assert.equal(state.stage, 1, 'the schedule advances one step, not two');
});

test('a refused write leaves no orphaned event: the whole thing is one transaction', { skip }, async () => {
  const learner = await newLearner();
  const [card] = await buildReviewQueue(learner.repo, learner.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 1,
  });

  await submitReview(learner.repo, learner.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: uuid(),
  });

  // Hand the adapter an expectation that is already wrong. The event insert
  // happens BEFORE the state update inside the function, so if the two were not
  // one transaction this would leave a review event with no matching state.
  const staleKey = uuid();
  await assert.rejects(
    () =>
      learner.repo.commitReview({
        learnerId: learner.id,
        cardId: card.id,
        rating: 'known',
        idempotencyKey: staleKey,
        reviewedAt: new Date(),
        expected: { state: 'new', stage: null },
        next: { state: 'review', stage: 4, dueAt: new Date(Date.now() + 86_400_000).toISOString() },
      }),
    StaleLearnerStateError,
  );

  assert.equal(
    await countReviews(learner, staleKey),
    0,
    'the refused event must have been rolled back, not left orphaned',
  );

  const states = await learner.repo.getLearnerStates(learner.id);
  const state = states.find((entry) => entry.cardId === card.id);
  assert.equal(state.stage, 1, 'the stale write must not have moved the schedule');
});

test('RLS keeps one learner out of another learner rows', { skip }, async () => {
  const alice = await newLearner();
  const bob = await newLearner();

  const [card] = await buildReviewQueue(alice.repo, alice.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 1,
  });
  await submitReview(alice.repo, alice.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: uuid(),
  });

  const bobStates = await bob.repo.getLearnerStates(bob.id);
  assert.equal(bobStates.length, 0, 'Bob must not see a single row of Alice progress');

  // Bob asking for Alice's rows by id must still return nothing: the filter is
  // the token, not the parameter.
  const bobSeesAlice = await bob.repo.getLearnerStates(alice.id);
  assert.equal(bobSeesAlice.length, 0, 'passing another learner id must not widen what RLS allows');

  const bobQueue = await buildReviewQueue(bob.repo, bob.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 5,
  });
  assert.ok(
    bobQueue.some((entry) => entry.id === card.id),
    "the card Alice rated must still be new for Bob",
  );
});

test('progress survives a brand-new client, which is what durability means', { skip }, async () => {
  const learner = await newLearner();
  const [card] = await buildReviewQueue(learner.repo, learner.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 1,
  });
  await submitReview(learner.repo, learner.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: uuid(),
  });

  // A fresh adapter with the same token: no in-process state carried over.
  const reconnected = createSupabaseRepository({
    url: config.url,
    publishableKey: config.publishableKey,
    accessToken: learner.accessToken,
  });

  const states = await reconnected.getLearnerStates(learner.id);
  assert.equal(states.length, 1, 'VOC-07: progress lives in the database, not in the process');
  assert.equal(states[0].cardId, card.id);
});

test('an unpublished card cannot be rated', { skip }, async () => {
  const learner = await newLearner();

  await assert.rejects(
    () =>
      submitReview(learner.repo, learner.id, {
        cardId: 'w_definitely_not_a_real_card',
        rating: 'known',
        idempotencyKey: uuid(),
      }),
    UnknownCardError,
    'the catalog check happens inside the write, as the deployed function does it',
  );
});

test('a learner can delete their own study data, and only their own', { skip }, async () => {
  const alice = await newLearner();
  const bob = await newLearner();

  const [card] = await buildReviewQueue(alice.repo, alice.id, {
    deck: deckSlug,
    mode: 'new',
    limit: 1,
  });
  await submitReview(alice.repo, alice.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: uuid(),
  });
  await submitReview(bob.repo, bob.id, {
    cardId: card.id,
    rating: 'known',
    idempotencyKey: uuid(),
  });

  const deleted = await deleteLearnerData(
    { accessToken: alice.accessToken },
    { VOCABULARY_DATA_SOURCE: 'supabase', ...config, SUPABASE_URL: config.url, SUPABASE_PUBLISHABLE_KEY: config.publishableKey },
  );

  assert.equal(deleted.deletedStates, 1);
  assert.equal(deleted.deletedReviews, 1);
  assert.equal((await alice.repo.getLearnerStates(alice.id)).length, 0, 'Alice data must be gone');

  // The function takes no learner argument at all, so this is the only way to
  // check the blast radius: Bob's identical row must survive Alice's delete.
  const bobStates = await bob.repo.getLearnerStates(bob.id);
  assert.equal(bobStates.length, 1, 'one learner deleting must not touch another learner rows');
});

test('deleting twice is not an error: the second call is a no-op', { skip }, async () => {
  const learner = await newLearner();
  const env = {
    VOCABULARY_DATA_SOURCE: 'supabase',
    SUPABASE_URL: config.url,
    SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
  };

  const first = await deleteLearnerData({ accessToken: learner.accessToken }, env);
  const second = await deleteLearnerData({ accessToken: learner.accessToken }, env);

  assert.equal(first.deletedStates, 0, 'a learner with nothing stored deletes nothing');
  assert.equal(second.deletedStates, 0, 'and asking again is still fine');
});
