import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { TextDecoder } from 'node:util';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DEFAULT_CATALOG = join(ROOT, '.generated', 'vocabulary', 'catalog-v1', 'vocabulary-catalog.v1.jsonl');
const decoder = new TextDecoder('utf-8', { fatal: true });

function arg(name, args = process.argv.slice(2)) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function nonEmpty(value) { return typeof value === 'string' && value.trim().length > 0; }

export function readCatalog(catalogPath) {
  if (!catalogPath.endsWith('.jsonl')) throw new Error('Importer accepts only a .jsonl catalog.');
  if (!existsSync(catalogPath)) throw new Error(`Catalog not found: ${relative(ROOT, catalogPath)}`);
  let text;
  try { text = decoder.decode(readFileSync(catalogPath)); } catch { throw new Error(`${basename(catalogPath)} is not valid UTF-8.`); }
  const ids = new Set();
  const cards = [];
  for (const [index, raw] of text.split(/\r?\n/u).entries()) {
    if (!raw.trim()) continue;
    let card;
    try { card = JSON.parse(raw); } catch (error) { throw new Error(`${basename(catalogPath)}:${index + 1} is not valid JSON: ${error.message}`); }
    if (!nonEmpty(card.id) || !nonEmpty(card.word) || !nonEmpty(card.topic)) {
      throw new Error(`${basename(catalogPath)}:${index + 1} needs id, word, and topic.`);
    }
    if (!Number.isInteger(card.order) || card.order < 0 || !Array.isArray(card.senses) || card.senses.length === 0) {
      throw new Error(`${basename(catalogPath)}:${index + 1} has invalid order or senses.`);
    }
    if (!card.senses.every((sense) => nonEmpty(sense?.def_vi))) {
      throw new Error(`${basename(catalogPath)}:${index + 1} has a missing Vietnamese definition.`);
    }
    if (ids.has(card.id)) throw new Error(`${basename(catalogPath)}:${index + 1} duplicate card ID: ${card.id}.`);
    ids.add(card.id);
    cards.push(card);
  }
  return cards;
}

export function cardRow(card, sourceVersion) {
  return {
    id: card.id, word: card.word, is_phrase: Boolean(card.is_phrase), primary_topic: card.topic,
    topics_all: card.topics_all, sort_order: card.order, cefr: card.cefr ?? null,
    target_band: card.target_band ?? null, phonetic: card.phonetic ?? null, senses: card.senses,
    examples: card.examples ?? null, collocations: card.collocations ?? null,
    content_status: 'draft', source_version: sourceVersion,
  };
}

async function upsertRows(rows, { supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/vocabulary_cards?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`Vocabulary card upsert failed (HTTP ${response.status}).`);
}

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const match = raw.trim().match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, '');
  }
}

export async function run(args = process.argv.slice(2)) {
  const catalogPath = resolve(arg('--catalog', args) ?? DEFAULT_CATALOG);
  const envFile = resolve(arg('--env-file', args) ?? join(ROOT, '.env.local'));
  loadEnv(envFile);
  const cards = readCatalog(catalogPath);
  const manifestPath = join(dirname(catalogPath), 'manifest.json');
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
  const sourceVersion = arg('--source-version', args) ?? manifest.catalog_sha256;
  if (!sourceVersion) throw new Error('--source-version is required when catalog manifest has no catalog_sha256.');
  const apply = args.includes('--apply');
  console.log(JSON.stringify({ catalog: relative(ROOT, catalogPath), cards: cards.length, sourceVersion, apply }, null, 2));
  if (!apply) return { cards: cards.length, sourceVersion };
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply.');
  for (let index = 0; index < cards.length; index += 250) await upsertRows(cards.slice(index, index + 250).map((card) => cardRow(card, sourceVersion)), { supabaseUrl, serviceRoleKey });
  return { cards: cards.length, sourceVersion };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run();
