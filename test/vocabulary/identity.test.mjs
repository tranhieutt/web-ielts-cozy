/**
 * Learner identity tests (VOC-API-01).
 *
 * Anonymous Auth is stubbed at `fetch`, so these prove the session lifecycle —
 * mint, reuse, refresh, recover — and the cookie rules. What they cannot prove
 * is that Supabase actually issues an anonymous user; that needs
 * `enable_anonymous_sign_ins` on a real environment (VOC-INFRA-06).
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AnonymousAuthError,
  isExpired,
  refreshSession,
  signInAnonymously,
} from '../../apps/web/src/features/vocabulary/auth/anonymous.ts';
import {
  ACCESS_COOKIE,
  LEARNER_COOKIE,
  REFRESH_COOKIE,
  attachLearnerSession,
  resolveLearner,
} from '../../apps/web/src/features/vocabulary/identity.ts';

const LEARNER = '11111111-1111-4111-8111-111111111111';

const SUPABASE_ENV = {
  VOCABULARY_DATA_SOURCE: 'supabase',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};

/** Builds a JWT-shaped token. Unsigned: nothing under test verifies signatures. */
function token(sub, expiresInSeconds) {
  const payload = Buffer.from(
    JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }),
  ).toString('base64url');
  return `header.${payload}.signature`;
}

function stubAuth(body, status = 200) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { impl, calls };
}

/** Minimal stand-in for NextRequest's cookie jar. */
const requestWith = (cookies) => ({
  cookies: { get: (name) => (name in cookies ? { value: cookies[name] } : undefined) },
});

/** Records what would be written to Set-Cookie. */
const responseSink = () => {
  const written = new Map();
  return { written, cookies: { set: (options) => written.set(options.name, options) } };
};

test('a fresh visitor in supabase mode is minted an anonymous learner', async () => {
  const { impl, calls } = stubAuth({
    access_token: token(LEARNER, 3600),
    refresh_token: 'refresh-1',
    expires_in: 3600,
    user: { id: LEARNER },
  });

  const session = await signInAnonymously(
    { ...SUPABASE_ENV, url: SUPABASE_ENV.SUPABASE_URL, publishableKey: 'k', fetchImpl: impl },
  );

  assert.equal(session.learnerId, LEARNER, 'D-12: the anonymous UUID is the learner id');
  assert.ok(calls[0].url.endsWith('/auth/v1/signup'));
  assert.equal(calls[0].init.headers.apikey, 'k');
});

test('anonymous sign-in disabled in the environment reports why', async () => {
  const { impl } = stubAuth({ msg: 'anonymous sign-ins are disabled' }, 422);

  await assert.rejects(
    () => signInAnonymously({ url: 'https://p.supabase.co', publishableKey: 'k', fetchImpl: impl }),
    (error) =>
      error instanceof AnonymousAuthError && /enable_anonymous_sign_ins/.test(error.message),
    'a 422 is a deployment mistake and should say so rather than look like a learner error',
  );
});

test('a valid access token is reused without minting a second learner', async () => {
  const request = requestWith({ [ACCESS_COOKIE]: token(LEARNER, 3600) });

  const learner = await resolveLearner(request, SUPABASE_ENV);

  assert.equal(learner.learnerId, LEARNER);
  assert.equal(learner.isNew, false);
  assert.equal(learner.session, undefined, 'nothing to re-write when the token still works');
});

test('an expired access token does not authorise anything', async () => {
  // No refresh cookie, so resolution must not silently accept the dead token.
  const request = requestWith({ [ACCESS_COOKIE]: token(LEARNER, -10) });

  await assert.rejects(
    () => resolveLearner(request, { ...SUPABASE_ENV, SUPABASE_URL: '' }),
    /SUPABASE_URL/,
    'it must try to get a NEW session rather than reuse the expired one',
  );
});

test('a token expiring within the skew window is treated as already expired', () => {
  assert.equal(isExpired({ expiresAt: Date.now() + 30_000 }), true, '30s is not enough runway');
  assert.equal(isExpired({ expiresAt: Date.now() + 300_000 }), false);
});

test('a malformed token is rejected rather than parsed hopefully', async () => {
  const { impl } = stubAuth({
    access_token: 'not-a-jwt',
    refresh_token: 'r',
    expires_in: 3600,
  });

  await assert.rejects(
    () => signInAnonymously({ url: 'https://p.supabase.co', publishableKey: 'k', fetchImpl: impl }),
    AnonymousAuthError,
  );
});

test('a refreshed session reports the same learner, not a new one', async () => {
  const { impl, calls } = stubAuth({
    access_token: token(LEARNER, 3600),
    refresh_token: 'refresh-2',
    expires_in: 3600,
    user: { id: LEARNER },
  });

  const session = await refreshSession(
    { url: 'https://p.supabase.co', publishableKey: 'k', fetchImpl: impl },
    'refresh-1',
  );

  assert.equal(session.learnerId, LEARNER, 'refreshing must not strand the learner on a new UUID');
  assert.ok(calls[0].url.includes('grant_type=refresh_token'));
  assert.equal(JSON.parse(calls[0].init.body).refresh_token, 'refresh-1');
});

test('fixture mode issues an unsigned id and never calls auth', async () => {
  const learner = await resolveLearner(requestWith({}), {});

  assert.equal(learner.isNew, true);
  assert.equal(learner.accessToken, undefined, 'fixture mode has no token to give');
  assert.match(learner.learnerId, /^[0-9a-f-]{36}$/u);
});

test('session tokens are written httpOnly so page scripts cannot read them', () => {
  const response = responseSink();

  attachLearnerSession(response, {
    learnerId: LEARNER,
    isNew: true,
    accessToken: 'access',
    session: {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3_600_000,
      learnerId: LEARNER,
    },
  });

  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    const cookie = response.written.get(name);
    assert.ok(cookie, `${name} must be written`);
    assert.equal(cookie.httpOnly, true, 'a readable token is a stealable token');
    assert.equal(cookie.sameSite, 'lax');
    assert.equal(cookie.path, '/');
  }

  assert.ok(
    !response.written.has(LEARNER_COOKIE),
    'the unsigned fixture id must not ride along with a real session',
  );
});

test('the refresh cookie outlives the access cookie so a returning learner keeps progress', () => {
  const response = responseSink();

  attachLearnerSession(response, {
    learnerId: LEARNER,
    isNew: true,
    accessToken: 'access',
    session: {
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresAt: Date.now() + 3_600_000,
      learnerId: LEARNER,
    },
  });

  const access = response.written.get(ACCESS_COOKIE);
  const refresh = response.written.get(REFRESH_COOKIE);

  assert.ok(access.maxAge <= 3600, 'the access cookie should not outlive the token itself');
  assert.equal(refresh.maxAge, 60 * 60 * 24 * 90, 'ADR-004 retention is 3 months');
});
