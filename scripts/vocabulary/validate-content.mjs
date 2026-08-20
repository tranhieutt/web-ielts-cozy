import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content', 'vocabulary', 'ielts_vocab_by_topic');
export const BASELINE = Object.freeze({ files: 23, cards: 5275, definitions: 7309 });

function fail(message) {
  throw new Error(message);
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function readSourceCards(contentDir = CONTENT_DIR) {
  const cards = [];
  const ids = new Set();
  const files = readdirSync(contentDir).filter((name) => name.endsWith('.jsonl')).sort();
  if (files.length === 0) fail('No JSONL files found.');

  for (const file of files) {
    const filePath = join(contentDir, file);
    const expectedTopic = basename(file, '.jsonl');
    for (const [lineIndex, rawLine] of readFileSync(filePath, 'utf8').split(/\r?\n/u).entries()) {
      const line = rawLine.trim();
      if (!line) continue;
      let card;
      try {
        card = JSON.parse(line);
      } catch (error) {
        fail(`${file}:${lineIndex + 1} is not valid JSON: ${error.message}`);
      }
      if (!nonEmpty(card.id) || !nonEmpty(card.word) || !nonEmpty(card.topic)) {
        fail(`${file}:${lineIndex + 1} is missing id, word, or topic.`);
      }
      if (card.topic !== expectedTopic) {
        fail(`${file}:${lineIndex + 1} card ${card.id} has primary topic ${card.topic}; expected ${expectedTopic}.`);
      }
      if (ids.has(card.id)) fail(`${file}:${lineIndex + 1} duplicate card ID: ${card.id}.`);
      if (!Array.isArray(card.senses) || card.senses.length === 0) fail(`${file}:${lineIndex + 1} card ${card.id} has no senses.`);
      for (const [senseIndex, sense] of card.senses.entries()) {
        if (!nonEmpty(sense?.def_vi)) {
          fail(`${file}:${lineIndex + 1} card ${card.id} sense ${senseIndex + 1} has no Vietnamese definition.`);
        }
      }
      ids.add(card.id);
      cards.push(card);
    }
  }
  return { cards, files, ids };
}

export function assertBaseline({ files, cards, definitions }, baseline = BASELINE) {
  const actual = { files: files.length, cards: cards.length, definitions };
  const mismatch = Object.entries(baseline)
    .filter(([key, expected]) => actual[key] !== expected)
    .map(([key, expected]) => `${key}=${actual[key]} (expected ${expected})`);
  if (mismatch.length > 0) fail(`Vocabulary source baseline mismatch: ${mismatch.join(', ')}.`);
}

function assertSafeCanonicalValue(value, location) {
  if (typeof value === 'string' && /youdao/iu.test(value)) {
    fail(`Canonical catalog contains forbidden Youdao value at ${location}.`);
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeCanonicalValue(item, `${location}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'def_zh' || key === 'zh') {
      fail(`Canonical catalog contains forbidden field ${location}.${key}.`);
    }
    assertSafeCanonicalValue(child, `${location}.${key}`);
  }
}

export function validateCanonicalCatalog(canonicalDir) {
  const catalogPath = join(canonicalDir, 'vocabulary-catalog.v1.jsonl');
  const manifestPath = join(canonicalDir, 'manifest.json');
  if (!existsSync(catalogPath)) fail(`Canonical catalog not found: ${catalogPath}`);
  if (!existsSync(manifestPath)) fail(`Canonical manifest not found: ${manifestPath}`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  let cards = 0;
  let definitions = 0;
  for (const [lineIndex, rawLine] of readFileSync(catalogPath, 'utf8').split(/\r?\n/u).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    let card;
    try {
      card = JSON.parse(line);
    } catch (error) {
      fail(`Canonical catalog line ${lineIndex + 1} is not valid JSON: ${error.message}`);
    }
    assertSafeCanonicalValue(card, `line ${lineIndex + 1}`);
    if (!Array.isArray(card.senses) || card.senses.some((sense) => !nonEmpty(sense.def_vi))) {
      fail(`Canonical catalog line ${lineIndex + 1} has missing Vietnamese definition.`);
    }
    cards += 1;
    definitions += card.senses.length;
  }
  if (manifest.cards !== cards || manifest.definitions !== definitions) {
    fail(`Canonical manifest totals mismatch: cards=${cards}/${manifest.cards}, definitions=${definitions}/${manifest.definitions}.`);
  }
  return { cards, definitions };
}

function validateAudio(ids, audioDir) {
  if (!audioDir || audioDir === ROOT) fail('Missing value for --audio-dir.');
  const manifestPath = join(audioDir, 'manifest.json');
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

export function validateContent({ contentDir = CONTENT_DIR, baseline = BASELINE, canonicalDir, requireAudio = false, audioDir } = {}) {
  const { cards, files, ids } = readSourceCards(contentDir);
  const definitions = cards.reduce((total, card) => total + card.senses.length, 0);
  assertBaseline({ files, cards, definitions }, baseline);
  const canonical = canonicalDir ? validateCanonicalCatalog(canonicalDir) : null;
  const audioFiles = requireAudio ? validateAudio(ids, audioDir) : 0;
  return {
    jsonlFiles: files.length,
    cards: cards.length,
    definitions,
    uniqueIds: ids.size,
    audioFiles,
    audioRequired: requireAudio,
    canonical,
  };
}

function argumentValue(name, args) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function run(args = process.argv.slice(2)) {
  const audioDirValue = argumentValue('--audio-dir', args);
  const summary = validateContent({
    requireAudio: args.includes('--require-audio'),
    audioDir: audioDirValue === undefined ? join(ROOT, '.generated', 'audio', 'vocabulary') : resolve(audioDirValue),
    canonicalDir: argumentValue('--canonical-dir', args),
  });
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run();
}
