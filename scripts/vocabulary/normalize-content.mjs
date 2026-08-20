import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content', 'vocabulary', 'ielts_vocab_by_topic');
const DEFAULT_OUTPUT_DIR = join(ROOT, '.generated', 'vocabulary', 'catalog-v1');

function argumentValue(name, args) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function fail(message) {
  throw new Error(message);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalString(value) {
  return nonEmptyString(value) ?? null;
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizedTranslation(value) {
  const result = { en: nonEmptyString(value?.en) };
  const vietnamese = nonEmptyString(value?.vi);
  if (!result.en) return null;
  if (vietnamese) result.vi = vietnamese;
  return result;
}

function normalizedPhonetic(value) {
  const uk = nonEmptyString(value?.uk);
  const us = nonEmptyString(value?.us);
  if (!uk && !us) return null;
  return { ...(uk ? { uk } : {}), ...(us ? { us } : {}) };
}

export function normalizeCard(card, sourceName) {
  const sourceTopic = basename(sourceName, '.jsonl');
  const cardId = nonEmptyString(card?.id);
  const word = nonEmptyString(card?.word);
  const topic = nonEmptyString(card?.topic);

  if (!cardId || !word || !topic) fail(`${sourceName}: card needs id, word, and topic.`);
  if (topic !== sourceTopic) fail(`${sourceName}: ${cardId} has topic ${topic}, expected ${sourceTopic}.`);
  if (!Number.isInteger(card.order) || card.order < 0) fail(`${sourceName}: ${cardId} needs non-negative integer order.`);
  if (!Array.isArray(card.senses) || card.senses.length === 0) fail(`${sourceName}: ${cardId} has no senses.`);

  const topicsAll = [...new Set((Array.isArray(card.topics_all) ? card.topics_all : [topic])
    .map(nonEmptyString)
    .filter(Boolean))];
  if (!topicsAll.includes(topic)) fail(`${sourceName}: ${cardId} topics_all must include primary topic ${topic}.`);

  const senses = card.senses.map((sense, index) => {
    const defVi = nonEmptyString(sense?.def_vi);
    if (!defVi) fail(`${sourceName}: ${cardId} sense ${index + 1} has no Vietnamese definition.`);
    const pos = nonEmptyString(sense?.pos);
    const defEn = nonEmptyString(sense?.def_en);
    return {
      ...(pos ? { pos } : {}),
      def_vi: defVi,
      ...(defEn ? { def_en: defEn } : {}),
    };
  });

  const examples = (Array.isArray(card.examples) ? card.examples : [])
    .map(normalizedTranslation)
    .filter(Boolean);
  const collocations = (Array.isArray(card.collocations) ? card.collocations : [])
    .map(normalizedTranslation)
    .filter(Boolean);
  const phonetic = normalizedPhonetic(card.phonetic);

  return {
    schema_version: 'vocabulary-card.v1',
    id: cardId,
    word,
    is_phrase: Boolean(card.is_phrase),
    topic,
    topics_all: topicsAll,
    order: card.order,
    cefr: optionalString(card.cefr),
    target_band: optionalString(card.target_band),
    ...(phonetic ? { phonetic } : {}),
    senses,
    ...(examples.length ? { examples } : {}),
    ...(collocations.length ? { collocations } : {}),
  };
}

export function normalizeCorpus(contentDir = CONTENT_DIR) {
  const files = readdirSync(contentDir).filter((name) => name.endsWith('.jsonl')).sort();
  if (files.length === 0) fail('No JSONL files found.');

  const ids = new Set();
  const cards = [];
  for (const file of files) {
    const filePath = join(contentDir, file);
    for (const [index, raw] of readFileSync(filePath, 'utf8').split(/\r?\n/u).entries()) {
      const line = raw.trim();
      if (!line) continue;
      let card;
      try {
        card = JSON.parse(line);
      } catch (error) {
        fail(`${file}:${index + 1} is not valid JSON: ${error.message}`);
      }
      const normalized = normalizeCard(card, file);
      if (ids.has(normalized.id)) fail(`${file}:${index + 1}: duplicate card ID ${normalized.id}.`);
      ids.add(normalized.id);
      cards.push(normalized);
    }
  }

  cards.sort((left, right) => left.topic.localeCompare(right.topic) || left.order - right.order || left.id.localeCompare(right.id));
  return { cards, files };
}

function writeAtomically(filePath, value) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  const temp = `${filePath}.tmp`;
  writeFileSync(temp, value, 'utf8');
  renameSync(temp, filePath);
}

export function createNormalizedCatalog({ contentDir = CONTENT_DIR, outputDir = DEFAULT_OUTPUT_DIR } = {}) {
  const { cards, files } = normalizeCorpus(contentDir);
  const catalog = `${cards.map((card) => JSON.stringify(card)).join('\n')}\n`;
  const definitions = cards.reduce((total, card) => total + card.senses.length, 0);
  return {
    cards,
    catalog,
    manifest: {
      schema_version: 'vocabulary-catalog.v1',
      source_files: files,
      cards: cards.length,
      definitions,
      catalog_sha256: sha256(catalog),
      excluded_source_fields: ['audio', 'def_zh', 'examples[].zh', 'collocations[].zh'],
    },
    catalogPath: join(outputDir, 'vocabulary-catalog.v1.jsonl'),
    manifestPath: join(outputDir, 'manifest.json'),
  };
}

export function run(args = process.argv.slice(2)) {
  const outputDir = resolve(argumentValue('--out-dir', args) ?? DEFAULT_OUTPUT_DIR);
  const apply = args.includes('--apply');
  const result = createNormalizedCatalog({ outputDir });
  const summary = {
    output_dir: relative(ROOT, outputDir),
    cards: result.manifest.cards,
    definitions: result.manifest.definitions,
    catalog_sha256: result.manifest.catalog_sha256,
    apply,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log('Dry run only. Add --apply to write the normalized catalog and manifest.');
    return result;
  }

  writeAtomically(result.catalogPath, result.catalog);
  writeAtomically(result.manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run();
}
