/**
 * VOC-API-07 — audio release gate (ADR-003).
 *
 * The point of these tests is that "off" is the default and that a half
 * configuration cannot leak URLs.
 */
import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

const MODULE = '../../apps/web/src/features/vocabulary/audio.ts';

const ORIGINAL = {
  enabled: process.env.VOCABULARY_AUDIO_ENABLED,
  baseUrl: process.env.VOCABULARY_AUDIO_BASE_URL,
};

function restore() {
  if (ORIGINAL.enabled === undefined) delete process.env.VOCABULARY_AUDIO_ENABLED;
  else process.env.VOCABULARY_AUDIO_ENABLED = ORIGINAL.enabled;
  if (ORIGINAL.baseUrl === undefined) delete process.env.VOCABULARY_AUDIO_BASE_URL;
  else process.env.VOCABULARY_AUDIO_BASE_URL = ORIGINAL.baseUrl;
}

afterEach(restore);

test('audio is off when nothing is configured', async () => {
  delete process.env.VOCABULARY_AUDIO_ENABLED;
  delete process.env.VOCABULARY_AUDIO_BASE_URL;
  const { isAudioEnabled, resolveAudioSources } = await import(MODULE);

  assert.equal(isAudioEnabled(), false);
  assert.equal(resolveAudioSources('w_1'), null);
});

test('a half configuration never leaks URLs', async () => {
  const { isAudioEnabled, resolveAudioSources } = await import(MODULE);

  // Flag on, no approved origin.
  process.env.VOCABULARY_AUDIO_ENABLED = 'true';
  delete process.env.VOCABULARY_AUDIO_BASE_URL;
  assert.equal(isAudioEnabled(), false);
  assert.equal(resolveAudioSources('w_1'), null);

  // Origin configured, flag still closed — the QA gate has not passed.
  process.env.VOCABULARY_AUDIO_ENABLED = 'false';
  process.env.VOCABULARY_AUDIO_BASE_URL = 'https://cdn.example/storage/v1/object/public/vocabulary-audio';
  assert.equal(isAudioEnabled(), false);
  assert.equal(resolveAudioSources('w_1'), null);
});

test('only an exact "true" opens the gate', async () => {
  const { isAudioEnabled } = await import(MODULE);
  process.env.VOCABULARY_AUDIO_BASE_URL = 'https://cdn.example/vocabulary-audio';

  for (const value of ['1', 'yes', 'TRUE', 'on', '']) {
    process.env.VOCABULARY_AUDIO_ENABLED = value;
    assert.equal(isAudioEnabled(), false, `"${value}" must not enable audio`);
  }

  process.env.VOCABULARY_AUDIO_ENABLED = 'true';
  assert.equal(isAudioEnabled(), true);
});

test('open gate builds approved Google TTS object paths, never Youdao', async () => {
  const { resolveAudioSources } = await import(MODULE);
  process.env.VOCABULARY_AUDIO_ENABLED = 'true';
  process.env.VOCABULARY_AUDIO_BASE_URL = 'https://cdn.example/vocabulary-audio/';

  const sources = resolveAudioSources('w_3c45881163');

  assert.deepEqual(sources, {
    uk: 'https://cdn.example/vocabulary-audio/v1/uk/w_3c45881163.mp3',
    us: 'https://cdn.example/vocabulary-audio/v1/us/w_3c45881163.mp3',
  });
  assert.ok(!JSON.stringify(sources).includes('youdao'));
});

test('queue payload omits audio entirely while the gate is closed', async () => {
  delete process.env.VOCABULARY_AUDIO_ENABLED;
  delete process.env.VOCABULARY_AUDIO_BASE_URL;
  const { buildReviewQueue } = await import('../../apps/web/src/features/vocabulary/service.ts');

  const cards = await buildReviewQueue('33333333-3333-4333-8333-333333333333', {
    deck: 'environment',
    mode: 'new',
    limit: 5,
  });

  assert.ok(cards.length > 0);
  assert.ok(
    cards.every((card) => !('audio' in card)),
    'a closed gate must omit the key, not send null',
  );
});
