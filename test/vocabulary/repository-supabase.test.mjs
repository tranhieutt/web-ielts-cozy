/**
 * Supabase adapter contract tests (VOC-API-02s / 03s / 05s).
 *
 * These run against a stub `fetch`, not a live project, so they assert what the
 * adapter SENDS and how it maps what comes back. What they deliberately cannot
 * prove — that the RPC is genuinely transactional and that RLS isolates
 * learners — needs a seeded database and belongs to `VOC-QA-02`.
 *
 * The point of asserting on the outgoing request is that the security rules
 * here are request-shaped: the wrong header or an extra `learner_id` filter is
 * exactly how RLS gets bypassed by accident.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SupabaseRepositoryError,
  createSupabaseRepository,
} from '../../apps/web/src/features/vocabulary/repository.supabase.ts';
import {
  StaleLearnerStateError,
  UnknownCardError,
} from '../../apps/web/src/features/vocabulary/repository.ts';

const URL_BASE = 'https://project.supabase.co';
const TOKEN = 'learner-access-token';
const KEY = 'publishable-key';

/** Records every outgoing call and answers with a queued body. */
function stubFetch(bodies, status = 200) {
  const calls = [];
  const queue = [...bodies];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const body = queue.shift() ?? [];
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { impl, calls };
}

const build = (bodies, status = 200) => {
  const { impl, calls } = stubFetch(bodies, status);
  return {
    calls,
    repo: createSupabaseRepository({
      url: URL_BASE,
      publishableKey: KEY,
      accessToken: TOKEN,
      fetchImpl: impl,
    }),
  };
};

const CARD_ROW = {
  id: 'w_1',
  word: 'emission',
  is_phrase: false,
  primary_topic: 'environment',
  topics_all: ['environment'],
  sort_order: 3,
  cefr: 'B2',
  target_band: '6.5',
  phonetic: { uk: '/ɪˈmɪʃ.ən/' },
  senses: [{ def_vi: 'khí thải' }],
  examples: null,
  collocations: null,
};

test('the adapter refuses to run without a learner access token', () => {
  assert.throws(
    () => createSupabaseRepository({ url: URL_BASE, publishableKey: KEY, accessToken: '' }),
    SupabaseRepositoryError,
    'an anon or service-role fallback would silently bypass RLS',
  );
});

test('every request carries the learner token, never only the publishable key', async () => {
  const { repo, calls } = build([[]]);
  await repo.listDecks();

  const headers = calls[0].init.headers;
  assert.equal(headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(headers.apikey, KEY);
});

test('learner state is never filtered by a client-supplied learner id', async () => {
  const { repo, calls } = build([[]]);
  await repo.getLearnerStates('11111111-1111-4111-8111-111111111111');

  const url = calls[0].url;
  assert.ok(
    !url.includes('learner_id'),
    'RLS derives the learner from the token; filtering by a passed-in id would invite trusting the client',
  );
});

test('card rows map onto the learner contract, dropping catalog-only columns', async () => {
  const { repo, calls } = build([[{ vocabulary_cards: CARD_ROW }]]);
  const [card] = await repo.listPublishableCards('environment');

  assert.equal(card.topic, 'environment', 'primary_topic becomes topic');
  assert.equal(card.order, 3, 'sort_order becomes order');
  assert.equal(card.word, 'emission');
  assert.ok(!('source_version' in card), 'internal content versioning must not reach the learner');
  assert.ok(!('audio_path_uk' in card), 'audio is the release gate’s business, not the row’s');
  assert.ok(!('examples' in card), 'a null column is omitted, not sent as null');
  assert.ok(!calls[0].url.includes('select=*'), 'select=* would leak new columns automatically');
});

test('a deck query cannot be widened into a corpus dump by a crafted slug', async () => {
  const { repo, calls } = build([[]]);
  await repo.listPublishableCards('environment&limit=9999');

  assert.ok(
    calls[0].url.includes('deck_slug=eq.environment%26limit%3D9999'),
    'the slug must be encoded so it stays one value instead of extra query params',
  );
});

const COMMIT = {
  learnerId: '11111111-1111-4111-8111-111111111111',
  cardId: 'w_1',
  rating: 'known',
  idempotencyKey: '44444444-4444-4444-8444-444444444444',
  reviewedAt: new Date('2026-08-21T03:00:00.000Z'),
  expected: { state: 'review', stage: 1 },
  next: { state: 'review', stage: 2, dueAt: '2026-08-22T03:00:00.000Z' },
};

test('commitReview sends one RPC matching the deployed function signature', async () => {
  const { repo, calls } = build([
    [
      {
        result_card_id: 'w_1',
        result_state: 'review',
        result_stage: 2,
        result_due_at: '2026-08-22T03:00:00+00:00',
        replayed: false,
      },
    ],
  ]);

  const outcome = await repo.commitReview(COMMIT);

  assert.equal(calls.length, 1, 'the write must be one call, not a read then a write');
  assert.ok(calls[0].url.endsWith('/rest/v1/rpc/submit_vocabulary_review'));

  const sent = JSON.parse(calls[0].init.body);
  // These names are the deployed function's, not ours to choose.
  assert.deepEqual(Object.keys(sent).sort(), [
    'p_card_id',
    'p_expected_stage',
    'p_expected_state',
    'p_idempotency_key',
    'p_next_due_at',
    'p_next_stage',
    'p_next_state',
    'p_rating',
    'p_reviewed_at',
  ]);
  assert.equal(sent.p_expected_stage, 1, 'the expected stage is the compare-and-swap guard');
  assert.ok(!('p_learner_id' in sent), 'the learner comes from auth.uid(), never from the body');

  assert.equal(outcome.replayed, false);
  assert.equal(outcome.stage, 2);
  assert.equal(outcome.dueAt, '2026-08-22T03:00:00.000Z', 'timestamps normalise to one ISO shape');
});

test('a replayed key returns the stored outcome flagged as a replay', async () => {
  const { repo } = build([
    [
      {
        result_card_id: 'w_1',
        result_state: 'review',
        result_stage: 1,
        result_due_at: '2026-08-22T03:00:00+00:00',
        replayed: true,
      },
    ],
  ]);

  // `next` deliberately disagrees with the response: the adapter must report
  // what was PERSISTED, not what this attempt recomputed.
  const outcome = await repo.commitReview({
    ...COMMIT,
    next: { state: 'review', stage: 3, dueAt: '2026-09-01T03:00:00.000Z' },
  });

  assert.equal(outcome.replayed, true);
  assert.equal(outcome.stage, 1, 'a replay must not advance the stage');
});

test('a lost compare-and-swap surfaces as a stale-state error, not a generic failure', async () => {
  const { repo } = build([{ message: 'stale learner state for w_1' }], 409);

  await assert.rejects(
    () => repo.commitReview(COMMIT),
    StaleLearnerStateError,
    'PT409 means another session moved the card; the caller must re-read, not retry blindly',
  );
});

test('an unknown card raised inside the function surfaces as UnknownCardError', async () => {
  const { repo } = build([{ message: 'unknown card: w_nope' }], 404);

  await assert.rejects(() => repo.commitReview(COMMIT), UnknownCardError);
});

test('a failed request raises without echoing the response body to the caller', async () => {
  const repo = createSupabaseRepository({
    url: URL_BASE,
    publishableKey: KEY,
    accessToken: TOKEN,
    fetchImpl: async () =>
      new Response(JSON.stringify({ message: 'permission denied for table' }), { status: 403 }),
  });

  await assert.rejects(() => repo.listDecks(), SupabaseRepositoryError);
});
