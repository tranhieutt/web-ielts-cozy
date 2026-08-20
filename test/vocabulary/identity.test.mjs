/**
 * VOC-API-01 — learner identity primitives.
 *
 * These cover the parts that decide *whose* data a request touches and *when*
 * a session is renewed. Getting either wrong is silent: a bad `sub` reads the
 * wrong learner, and a bad expiry check either thrashes the auth endpoint or
 * lets a dead token through mid-request.
 *
 * The network paths (`signInAnonymously`, `refreshSession`) are verified
 * against the real project rather than mocked — a mock of GoTrue proves only
 * that the mock matches itself.
 */
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

const MODULE = '../../apps/web/src/features/vocabulary/auth.supabase.ts';

const ORIGINAL = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_PUBLISHABLE_KEY,
};

function restore() {
  for (const [name, value] of [
    ['SUPABASE_URL', ORIGINAL.url],
    ['SUPABASE_PUBLISHABLE_KEY', ORIGINAL.key],
  ]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

afterEach(restore);

/** Build an unsigned JWT-shaped token. Signature is never inspected by readClaims. */
function tokenWith(claims) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(claims)}.not-a-real-signature`;
}

test('readClaims extracts sub and exp', async () => {
  const { readClaims } = await import(MODULE);
  const claims = readClaims(tokenWith({ sub: 'abc-123', exp: 1800000000 }));
  assert.deepEqual(claims, { sub: 'abc-123', exp: 1800000000 });
});

test('readClaims rejects malformed tokens instead of guessing', async () => {
  const { readClaims } = await import(MODULE);
  for (const bad of [
    '',
    'not-a-jwt',
    'only.two',
    'a.b.c.d',
    `${Buffer.from('{}').toString('base64url')}.!!!not-base64!!!.sig`,
    tokenWith({ exp: 1800000000 }), // no sub
    tokenWith({ sub: 'abc-123' }), // no exp
    tokenWith({ sub: 42, exp: 1800000000 }), // sub of the wrong type
    tokenWith({ sub: 'abc-123', exp: '1800000000' }), // exp of the wrong type
  ]) {
    assert.equal(readClaims(bad), null, `expected null for ${JSON.stringify(bad).slice(0, 40)}`);
  }
});

test('isExpired refreshes early rather than mid-flight', async () => {
  const { isExpired } = await import(MODULE);
  const now = 1_800_000_000_000; // ms
  const exp = 1_800_000_000; // s — same instant

  assert.equal(isExpired(exp + 3600, now), false, 'an hour of life left is not expired');
  assert.equal(isExpired(exp, now), true, 'expiring exactly now counts as expired');
  assert.equal(isExpired(exp - 1, now), true, 'already past counts as expired');
  // The skew is the point: a token with 30s left would die mid-request.
  assert.equal(isExpired(exp + 30, now), true, 'inside the skew window counts as expired');
  assert.equal(isExpired(exp + 61, now), false, 'outside the skew window is still usable');
});

test('isConfigured gates real auth on BOTH env vars, never one', async () => {
  const { isConfigured } = await import(MODULE);

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  delete process.env.SUPABASE_PUBLISHABLE_KEY;
  assert.equal(isConfigured(), false, 'url alone must not enable real auth');

  delete process.env.SUPABASE_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_x';
  assert.equal(isConfigured(), false, 'key alone must not enable real auth');

  process.env.SUPABASE_URL = 'https://example.supabase.co';
  assert.equal(isConfigured(), true);

  process.env.SUPABASE_URL = '   ';
  assert.equal(isConfigured(), false, 'blank is absent, not present');
});

test('createPkcePair produces a valid RFC 7636 S256 challenge', async () => {
  const { createHash } = await import('node:crypto');
  const { createPkcePair } = await import('../../apps/web/src/features/vocabulary/identity.ts');

  const { verifier, challenge } = createPkcePair();

  // Length bounds come from RFC 7636 §4.1; too short is guessable.
  assert.ok(verifier.length >= 43 && verifier.length <= 128, `verifier length ${verifier.length}`);
  assert.match(verifier, /^[A-Za-z0-9_-]+$/, 'verifier must be base64url with no padding');
  assert.equal(challenge, createHash('sha256').update(verifier).digest('base64url'));

  // The whole point is that the verifier is unguessable per attempt.
  assert.notEqual(createPkcePair().verifier, verifier);
});
