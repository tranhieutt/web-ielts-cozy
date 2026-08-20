import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content', 'vocabulary', 'ielts_vocab_by_topic');
const DEFAULT_OUTPUT_DIR = join(ROOT, '.generated', 'audio', 'vocabulary');
const DEFAULT_PROJECT = 'hanzi-cozy-diary';
const DEFAULT_TOKEN_TTL_MS = 55 * 60 * 1000;
export const TOKEN_REFRESH_WINDOW_MS = 5 * 60 * 1000;
const WINDOWS_GCLOUD = join(
  process.env.LOCALAPPDATA ?? '',
  'Google',
  'Cloud SDK',
  'google-cloud-sdk',
  'bin',
  'gcloud.cmd',
);

const VOICES = {
  uk: { languageCode: 'en-GB', name: process.env.TTS_VOICE_UK ?? 'en-GB-Neural2-A' },
  us: { languageCode: 'en-US', name: process.env.TTS_VOICE_US ?? 'en-US-Neural2-A' },
};

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function parsePositiveInteger(value, name) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

const accent = argumentValue('--accent') ?? 'uk';
if (!['uk', 'us', 'both'].includes(accent)) throw new Error('--accent must be uk, us, or both.');

const options = {
  accent,
  apply: process.argv.includes('--apply'),
  batchDelayMs: parsePositiveInteger(argumentValue('--delay-ms'), '--delay-ms') ?? 100,
  concurrency: parsePositiveInteger(argumentValue('--concurrency'), '--concurrency') ?? 4,
  limit: parsePositiveInteger(argumentValue('--limit'), '--limit'),
  outputDir: argumentValue('--out-dir') ?? DEFAULT_OUTPUT_DIR,
  project: argumentValue('--project') ?? process.env.GOOGLE_CLOUD_PROJECT ?? DEFAULT_PROJECT,
};

function hash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function listCards() {
  const cards = [];
  const seenIds = new Set();
  for (const file of readdirSync(CONTENT_DIR).filter((name) => name.endsWith('.jsonl')).sort()) {
    const filePath = join(CONTENT_DIR, file);
    for (const [index, rawLine] of readFileSync(filePath, 'utf8').split(/\r?\n/u).entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      const row = JSON.parse(line);
      if (!row.id || !row.word) throw new Error(`${relative(ROOT, filePath)} line ${index + 1} is missing id or word.`);
      if (seenIds.has(row.id)) throw new Error(`Duplicate card ID: ${row.id}`);
      seenIds.add(row.id);
      cards.push({ id: row.id, text: row.word, textHash: hash(row.word) });
    }
  }
  return cards;
}

export function getAccessToken() {
  const gcloudBin = process.env.GCLOUD_BIN || (process.platform === 'win32' ? WINDOWS_GCLOUD : 'gcloud');
  if (process.platform === 'win32' && (!gcloudBin || !existsSync(gcloudBin))) {
    throw new Error('gcloud not found. Set GCLOUD_BIN or install Google Cloud CLI.');
  }
  const command = ['auth', 'application-default', 'print-access-token'];
  const invocation = process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-Command', `& '${gcloudBin.replace(/'/g, "''")}' ${command.join(' ')}`]]
    : [gcloudBin, command];
  return execFileSync(invocation[0], invocation[1], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function normalizeToken(result, now, ttlMs) {
  const token = typeof result === 'string' ? result : result?.token;
  if (typeof token !== 'string' || !token.trim()) throw new Error('Google access-token provider returned an empty token.');
  const expiresAt = typeof result === 'object' && Number.isFinite(result.expiresAt)
    ? result.expiresAt
    : now + ttlMs;
  return { token: token.trim(), expiresAt };
}

export function createTokenProvider({
  fetchToken = getAccessToken,
  now = () => Date.now(),
  refreshWindowMs = TOKEN_REFRESH_WINDOW_MS,
  tokenTtlMs = DEFAULT_TOKEN_TTL_MS,
} = {}) {
  let current;
  let refreshing;
  async function refresh() {
    if (!refreshing) {
      refreshing = (async () => {
        current = normalizeToken(await fetchToken(), now(), tokenTtlMs);
        return current.token;
      })().finally(() => {
        refreshing = undefined;
      });
    }
    return refreshing;
  }
  return {
    async get() {
      if (!current || current.expiresAt - now() <= refreshWindowMs) return refresh();
      return current.token;
    },
    refresh,
  };
}

function manifestPath() {
  return join(options.outputDir, 'manifest.json');
}

function readManifest() {
  const filePath = manifestPath();
  if (!existsSync(filePath)) {
    return { version: 1, project: options.project, audioEncoding: 'MP3', entries: {} };
  }
  const manifest = JSON.parse(readFileSync(filePath, 'utf8'));
  if (manifest.version !== 1 || manifest.project !== options.project || typeof manifest.entries !== 'object') {
    throw new Error(`Invalid manifest: ${relative(ROOT, filePath)}`);
  }
  return manifest;
}

function writeManifest(manifest) {
  mkdirSync(options.outputDir, { recursive: true });
  const target = manifestPath();
  const temp = `${target}.tmp`;
  writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  renameSync(temp, target);
}

function selectedAccents() {
  return options.accent === 'both' ? ['uk', 'us'] : [options.accent];
}

function outputPath(card, accentKey) {
  return join(options.outputDir, accentKey, `${card.id}.mp3`);
}

export async function synthesize(card, accentKey, tokenProvider, { fetchImpl = fetch, project = options.project } = {}) {
  const accessToken = await tokenProvider.get();
  const voice = VOICES[accentKey];
  const response = await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
      'x-goog-user-project': project,
    },
    body: JSON.stringify({
      input: { text: card.text },
      voice,
      audioConfig: { audioEncoding: 'MP3', speakingRate: 0.9 },
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.audioContent) {
    const error = new Error(`Google TTS request failed (HTTP ${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return Buffer.from(payload.audioContent, 'base64');
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

export async function synthesizeWithRetry(card, accentKey, tokenProvider, dependencies = {}) {
  const maxAttempts = dependencies.maxAttempts ?? 3;
  const wait = dependencies.delay ?? delay;
  let retriedAuth = false;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await synthesize(card, accentKey, tokenProvider, dependencies);
    } catch (error) {
      if (error.status === 401 && !retriedAuth) {
        retriedAuth = true;
        await tokenProvider.refresh();
        continue;
      }
      attempt += 1;
      if (attempt === maxAttempts) throw error;
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.error(`${card.id} ${accentKey} attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMs}ms.`);
      await wait(waitMs);
    }
  }
  throw new Error('Audio retry loop exited unexpectedly.');
}

function workItems(cards, manifest) {
  return cards.flatMap((card) => selectedAccents().map((accentKey) => ({
    card,
    accentKey,
    voice: VOICES[accentKey],
    relativeFile: relative(ROOT, outputPath(card, accentKey)).replaceAll('\\', '/'),
    existing: manifest.entries[`${card.id}:${accentKey}`],
  })));
}

function isCurrent(item) {
  return item.existing
    && item.existing.textHash === item.card.textHash
    && item.existing.voice === item.voice.name
    && existsSync(outputPath(item.card, item.accentKey));
}

export async function main() {
  const cards = listCards();
  const selectedCards = options.limit ? cards.slice(0, options.limit) : cards;
  const manifest = readManifest();
  const items = workItems(selectedCards, manifest);
  const pending = items.filter((item) => !isCurrent(item));
  const inputCharacters = pending.reduce((total, item) => total + Array.from(item.card.text).length, 0);

  console.log(JSON.stringify({
    cards: cards.length,
    selectedCards: selectedCards.length,
    accents: selectedAccents(),
    pendingFiles: pending.length,
    pendingInputCharacters: inputCharacters,
    concurrency: options.concurrency,
    outputDir: relative(ROOT, options.outputDir),
    apply: options.apply,
  }, null, 2));
  if (!options.apply) {
    console.log('Dry run only. Add --apply to synthesize and write generated MP3 files.');
    return;
  }

  mkdirSync(options.outputDir, { recursive: true });
  const tokenProvider = createTokenProvider();
  let nextIndex = 0;
  let completed = 0;
  const checkpointEvery = 25;
  async function worker() {
    while (true) {
      const item = pending[nextIndex];
      nextIndex += 1;
      if (!item) return;
      const audio = await synthesizeWithRetry(item.card, item.accentKey, tokenProvider);
      const target = outputPath(item.card, item.accentKey);
      mkdirSync(join(options.outputDir, item.accentKey), { recursive: true });
      const temp = `${target}.tmp`;
      writeFileSync(temp, audio);
      renameSync(temp, target);
      manifest.entries[`${item.card.id}:${item.accentKey}`] = {
        cardId: item.card.id,
        textHash: item.card.textHash,
        voice: item.voice.name,
        languageCode: item.voice.languageCode,
        file: item.relativeFile,
      };
      completed += 1;
      if (completed % checkpointEvery === 0 || completed === pending.length) {
        writeManifest(manifest);
        console.log(`Generated ${completed}/${pending.length}.`);
      }
      if (options.batchDelayMs > 0) await delay(options.batchDelayMs);
    }
  }
  const workerCount = Math.min(options.concurrency, pending.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  writeManifest(manifest);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
