import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content', 'vocabulary', 'ielts_vocab_by_topic');
const DEFAULT_OUTPUT_DIR = join(ROOT, '.generated', 'audio', 'vocabulary');
const DEFAULT_PROJECT = 'hanzi-cozy-diary';
const WINDOWS_GCLOUD = join(
  process.env.LOCALAPPDATA ?? '',
  'Google',
  'Cloud SDK',
  'google-cloud-sdk',
  'bin',
  'gcloud.cmd',
);

const VOICES = {
  uk: {
    languageCode: 'en-GB',
    name: process.env.TTS_VOICE_UK ?? 'en-GB-Neural2-A',
  },
  us: {
    languageCode: 'en-US',
    name: process.env.TTS_VOICE_US ?? 'en-US-Neural2-A',
  },
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
if (!['uk', 'us', 'both'].includes(accent)) {
  throw new Error('--accent must be uk, us, or both.');
}

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

function getAccessToken() {
  const gcloudBin = process.env.GCLOUD_BIN || (process.platform === 'win32' ? WINDOWS_GCLOUD : 'gcloud');
  if (process.platform === 'win32' && (!gcloudBin || !existsSync(gcloudBin))) {
    throw new Error('gcloud not found. Set GCLOUD_BIN or install Google Cloud CLI.');
  }
  const command = ['auth', 'application-default', 'print-access-token'];
  const invocation = process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-Command', `& '${gcloudBin.replace(/'/g, "''")}' ${command.join(' ')}`]]
    : [gcloudBin, command];
  return execFileSync(invocation[0], invocation[1], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function manifestPath() {
  return join(options.outputDir, 'manifest.json');
}

function readManifest() {
  const filePath = manifestPath();
  if (!existsSync(filePath)) {
    return {
      version: 1,
      project: options.project,
      audioEncoding: 'MP3',
      entries: {},
    };
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

async function synthesize(card, accentKey, accessToken) {
  const voice = VOICES[accentKey];
  const response = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
      'x-goog-user-project': options.project,
    },
    body: JSON.stringify({
      input: { text: card.text },
      voice,
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 0.9,
      },
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.audioContent) {
    throw new Error(`Google TTS ${response.status}: ${JSON.stringify(payload)}`);
  }
  return Buffer.from(payload.audioContent, 'base64');
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function synthesizeWithRetry(card, accentKey, accessToken) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await synthesize(card, accentKey, accessToken);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.error(`${card.id} ${accentKey} attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMs}ms.`);
      await delay(waitMs);
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

async function main() {
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
  const accessToken = getAccessToken();
  let nextIndex = 0;
  let completed = 0;
  const checkpointEvery = 25;

  async function worker() {
    while (true) {
      const item = pending[nextIndex];
      nextIndex += 1;
      if (!item) return;

      const audio = await synthesizeWithRetry(item.card, item.accentKey, accessToken);
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

await main();
