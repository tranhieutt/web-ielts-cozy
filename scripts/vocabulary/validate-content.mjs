import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content', 'vocabulary', 'ielts_vocab_by_topic');
const audioDirFlagIndex = process.argv.indexOf('--audio-dir');
const AUDIO_DIR = resolve(audioDirFlagIndex === -1
  ? join(ROOT, '.generated', 'audio', 'vocabulary')
  : process.argv[audioDirFlagIndex + 1] ?? '');
const requireAudio = process.argv.includes('--require-audio');

function fail(message) {
  throw new Error(message);
}

function readCards() {
  const cards = [];
  const ids = new Set();
  const files = readdirSync(CONTENT_DIR).filter((name) => name.endsWith('.jsonl')).sort();
  if (files.length === 0) fail('No JSONL files found.');

  for (const file of files) {
    const filePath = join(CONTENT_DIR, file);
    for (const [lineIndex, rawLine] of readFileSync(filePath, 'utf8').split(/\r?\n/u).entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      let card;
      try {
        card = JSON.parse(line);
      } catch (error) {
        fail(`${file}:${lineIndex + 1} is not valid JSON: ${error.message}`);
      }
      if (!card.id || !card.word || !card.topic) fail(`${file}:${lineIndex + 1} is missing id, word, or topic.`);
      if (ids.has(card.id)) fail(`Duplicate card ID: ${card.id}`);
      if (!Array.isArray(card.senses) || card.senses.length === 0) fail(`${card.id} has no senses.`);
      for (const [senseIndex, sense] of card.senses.entries()) {
        if (typeof sense.def_vi !== 'string' || !sense.def_vi.trim()) {
          fail(`${card.id} sense ${senseIndex} has no Vietnamese definition.`);
        }
      }
      ids.add(card.id);
      cards.push(card);
    }
  }
  return { cards, files, ids };
}

function validateAudio(ids) {
  if (!AUDIO_DIR || AUDIO_DIR === ROOT) fail('Missing value for --audio-dir.');
  const manifestPath = join(AUDIO_DIR, 'manifest.json');
  if (!existsSync(manifestPath)) fail(`Audio manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const expectedKeys = new Set([...ids].flatMap((id) => [`${id}:uk`, `${id}:us`]));
  const keys = Object.keys(manifest.entries ?? {});
  if (keys.length !== expectedKeys.size) fail(`Audio manifest has ${keys.length} entries; expected ${expectedKeys.size}.`);

  for (const key of expectedKeys) {
    const entry = manifest.entries[key];
    if (!entry?.file) fail(`Audio manifest missing ${key}.`);
    const filePath = resolve(ROOT, entry.file);
    if (!existsSync(filePath)) fail(`Audio file missing: ${entry.file}`);
    const header = readFileSync(filePath).subarray(0, 2);
    if (header.length !== 2 || header[0] !== 0xff || (header[1] & 0xe0) !== 0xe0) {
      fail(`Invalid MP3 header: ${entry.file}`);
    }
  }
  return keys.length;
}

const { cards, files, ids } = readCards();
const definitions = cards.reduce((total, card) => total + card.senses.length, 0);
const audioFiles = requireAudio ? validateAudio(ids) : 0;
console.log(JSON.stringify({
  jsonlFiles: files.length,
  cards: cards.length,
  definitions,
  uniqueIds: ids.size,
  audioFiles,
  audioRequired: requireAudio,
}, null, 2));
