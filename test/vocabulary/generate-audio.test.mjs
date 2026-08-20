import assert from 'node:assert/strict';
import test from 'node:test';

import { TOKEN_REFRESH_WINDOW_MS, createTokenProvider, synthesizeWithRetry } from '../../scripts/vocabulary/generate-audio.mjs';

test('refreshes a near-expiry token before TTS request', async () => {
  let now = 1_000_000;
  let calls = 0;
  const provider = createTokenProvider({
    now: () => now,
    fetchToken: () => ({ token: `token-${++calls}`, expiresAt: now + TOKEN_REFRESH_WINDOW_MS + 1 }),
  });
  assert.equal(await provider.get(), 'token-1');
  now += 2;
  assert.equal(await provider.get(), 'token-2');
  assert.equal(calls, 2);
});

test('retries one 401 with a fresh token and never logs token text', async () => {
  const secretTokens = ['token-one-secret', 'token-two-secret'];
  let tokenCalls = 0;
  const provider = createTokenProvider({
    fetchToken: () => ({ token: secretTokens[tokenCalls++], expiresAt: Date.now() + 60 * 60 * 1000 }),
  });
  const requests = [];
  const logs = [];
  const originalError = console.error;
  console.error = (message) => logs.push(String(message));
  try {
    const audio = await synthesizeWithRetry(
      { id: 'w_test', text: 'test' },
      'uk',
      provider,
      {
        fetchImpl: async (_url, request) => {
          requests.push(request.headers.Authorization);
          return requests.length === 1
            ? { ok: false, status: 401, json: async () => ({ error: { message: 'expired' } }) }
            : { ok: true, status: 200, json: async () => ({ audioContent: Buffer.from('mp3').toString('base64') }) };
        },
        delay: async () => {},
      },
    );
    assert.deepEqual(audio, Buffer.from('mp3'));
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(requests, ['Bearer token-one-secret', 'Bearer token-two-secret']);
  assert.equal(tokenCalls, 2);
  assert.equal(logs.some((line) => secretTokens.some((token) => line.includes(token))), false);
});
