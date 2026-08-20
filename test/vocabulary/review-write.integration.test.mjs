/**
 * VOC-QA-02 — review write, against the REAL Supabase project.
 *
 * Everything here is deliberately un-mocked. The properties under test —
 * transactionality, the unique `(learner_id, idempotency_key)` constraint, and
 * RLS — are properties of Postgres, not of application code. A mock would only
 * prove the mock agrees with itself, which is exactly the class of bug this
 * suite exists to catch.
 *
 * Opt-in: `VOCABULARY_INTEGRATION=1 npm run vocab:test-integration`. It is kept
 * out of `npm test` because it needs credentials, needs the network, and mints
 * real anonymous users.
 *
 * TEST DATA: anonymous learners created here are NOT deleted afterwards —
 * deleting an `auth.users` row needs the service-role key, which must never be
 * in the app's reach. They carry no personal data and fall under the 30-day
 * retention sweep in ADR-004.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test, { before, describe } from 'node:test';

const PUBLISHED_CARD = 'w_001ba5257d';
/** Real row, `content_status <> 'published'`, so RLS must hide it from learners. */
const UNPUBLISHED_CARD = 'w_0010c6d821';

/** `npm test` runs from the repo root; the app's env file is the only source. */
function loadEnv() {
  try {
    for (const line of readFileSync('apps/web/.env.local', 'utf8').split('\n')) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // Env may be supplied by CI instead of a file.
  }
}

loadEnv();

const URL_BASE = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
const ENABLED = process.env.VOCABULARY_INTEGRATION === '1' && Boolean(URL_BASE && KEY);

async function signInAnonymously() {
  const response = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.ok(response.ok, `anonymous sign-in failed: ${response.status}`);
  const body = await response.json();
  return { token: body.access_token, refresh: body.refresh_token, id: body.user.id };
}

async function rest(token, path, init = {}) {
  const response = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  return { ok: response.ok, status: response.status, body: await response.json() };
}

function submit(token, { card = PUBLISHED_CARD, key, stage = 1, state = 'review' } = {}) {
  return rest(token, 'rpc/submit_vocabulary_review', {
    method: 'POST',
    body: JSON.stringify({
      p_card_id: card,
      p_rating: 'known',
      p_idempotency_key: key,
      p_reviewed_at: new Date().toISOString(),
      p_next_state: state,
      p_next_stage: stage,
      p_next_due_at: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  });
}

describe('VOC-QA-02 review write against Supabase', { skip: !ENABLED && 'set VOCABULARY_INTEGRATION=1' }, () => {
  let alice;
  let bob;

  before(async () => {
    [alice, bob] = await Promise.all([signInAnonymously(), signInAnonymously()]);
  });

  test('one call writes BOTH the event and the state', async () => {
    const key = crypto.randomUUID();
    const result = await submit(alice.token, { key });

    assert.ok(result.ok, `submit failed: ${JSON.stringify(result.body)}`);
    assert.equal(result.body[0].replayed, false);

    const states = await rest(alice.token, `learner_card_states?card_id=eq.${PUBLISHED_CARD}`);
    const reviews = await rest(alice.token, `learner_card_reviews?idempotency_key=eq.${key}`);

    // The point of the transaction: neither can exist without the other.
    assert.equal(states.body.length, 1, 'state row missing');
    assert.equal(reviews.body.length, 1, 'review row missing');
    assert.equal(states.body[0].stage, 1);
    assert.equal(reviews.body[0].previous_state, 'new', 'must record what it replaced');
  });

  test('replaying a key returns the original and never advances a stage', async () => {
    const key = crypto.randomUUID();
    const first = await submit(alice.token, { key, stage: 2 });

    // A retry that claims a DIFFERENT outcome must still be ignored — the key,
    // not the payload, decides. Otherwise a buggy client could rewrite history.
    const replay = await submit(alice.token, { key, stage: 5, state: 'mastered' });

    assert.equal(first.body[0].replayed, false);
    assert.equal(replay.body[0].replayed, true);
    assert.equal(replay.body[0].result_stage, first.body[0].result_stage);
    assert.equal(replay.body[0].result_due_at, first.body[0].result_due_at);

    const reviews = await rest(alice.token, `learner_card_reviews?idempotency_key=eq.${key}`);
    assert.equal(reviews.body.length, 1, 'a replay must not create a second event');
  });

  test('concurrent requests with one key produce exactly one event', async () => {
    const key = crypto.randomUUID();

    // This is the `unique_violation` branch in the RPC. Sequential replays never
    // reach it, so without this test that code path ships unexecuted.
    const results = await Promise.all(
      Array.from({ length: 6 }, () => submit(alice.token, { key, stage: 3 })),
    );

    for (const result of results) {
      assert.ok(result.ok, `a concurrent call failed: ${JSON.stringify(result.body)}`);
    }
    const stages = new Set(results.map((r) => r.body[0].result_stage));
    assert.equal(stages.size, 1, `all callers must agree on one outcome, got ${[...stages]}`);

    // Exactly one writer, five replays. Without this the test would still pass
    // if the calls quietly serialised and nothing ever collapsed a race.
    const writers = results.filter((r) => r.body[0].replayed === false);
    assert.equal(writers.length, 1, `exactly one caller may write, got ${writers.length}`);

    const reviews = await rest(alice.token, `learner_card_reviews?idempotency_key=eq.${key}`);
    assert.equal(reviews.body.length, 1, 'the unique constraint must collapse the race');
  });

  test('RLS keeps one learner out of another learner state', async () => {
    const seen = await rest(bob.token, 'learner_card_states?select=learner_id');
    assert.equal(seen.body.length, 0, "Bob must not see Alice's rows");

    // Forging the id must fail too: the WITH CHECK policy compares to auth.uid(),
    // so the credential decides ownership, not the payload.
    const forged = await rest(bob.token, 'learner_card_states', {
      method: 'POST',
      body: JSON.stringify({
        learner_id: alice.id,
        card_id: PUBLISHED_CARD,
        state: 'review',
        stage: 1,
        due_at: new Date().toISOString(),
      }),
    });
    assert.equal(forged.ok, false, 'writing to another learner must be rejected');
    assert.equal(forged.status, 403);
  });

  test('the RPC refuses an unpublished card rather than storing hidden progress', async () => {
    const result = await submit(bob.token, { card: UNPUBLISHED_CARD, key: crypto.randomUUID() });

    assert.equal(result.ok, false, 'an unpublished card must not become learner state');
    assert.match(JSON.stringify(result.body), /unknown card/);
  });

  test('an anonymous caller with no session cannot write at all', async () => {
    // The publishable key alone is not an identity: auth.uid() is null.
    const result = await submit(KEY, { key: crypto.randomUUID() });
    assert.equal(result.ok, false, 'the publishable key must not act as a learner');
  });

  test('state survives a brand new session for the same learner (VOC-07)', async () => {
    const key = crypto.randomUUID();
    await submit(alice.token, { key, stage: 4 });

    // A fresh token stands in for a reload or a restarted server: same learner,
    // no in-process memory involved.
    const refreshed = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: alice.refresh }),
    });

    const token = refreshed.ok ? (await refreshed.json()).access_token : alice.token;
    const states = await rest(token, `learner_card_states?card_id=eq.${PUBLISHED_CARD}`);

    assert.equal(states.body.length, 1);
    assert.ok(states.body[0].review_count >= 2, 'every non-replayed review must count');
  });
});
