import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readCatalog } from './import-catalog-to-supabase.mjs';
import { buildDeckMembership } from './build-deck-membership.mjs';

const ROOT = process.cwd();
function arg(name, args = process.argv.slice(2)) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
function loadEnv(file) { if (!existsSync(file)) return; for (const line of readFileSync(file, 'utf8').split(/\r?\n/u)) { const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/u); if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^['"]|['"]$/gu, ''); } }
async function upsert(table, rows, conflict, url, key, fetchImpl = fetch) { for (let i = 0; i < rows.length; i += 250) { const response = await fetchImpl(`${url}/rest/v1/${table}?on_conflict=${conflict}`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 250)) }); if (!response.ok) throw new Error(`${table} upsert failed (HTTP ${response.status}).`); } }

export function readContentVersion(catalogPath) {
  const manifestPath = join(dirname(catalogPath), 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`Catalog manifest not found: ${relative(ROOT, manifestPath)}`);
  const version = JSON.parse(readFileSync(manifestPath, 'utf8')).catalog_sha256;
  if (typeof version !== 'string' || !version.trim()) throw new Error(`Catalog manifest has no catalog_sha256: ${relative(ROOT, manifestPath)}`);
  return version;
}

export async function run(args = process.argv.slice(2)) {
  const catalog = resolve(arg('--catalog', args) ?? join(ROOT, '.generated', 'vocabulary', 'catalog-v1', 'vocabulary-catalog.v1.jsonl'));
  const envFile = resolve(arg('--env-file', args) ?? join(ROOT, '.env.local'));
  loadEnv(envFile);
  const contentVersion = arg('--content-version', args) ?? readContentVersion(catalog);
  const { decks, rows } = buildDeckMembership(readCatalog(catalog), { contentVersion });
  const apply = args.includes('--apply');
  console.log(JSON.stringify({ catalog: relative(ROOT, catalog), contentVersion, decks: decks.length, memberships: rows.length, apply }, null, 2));
  if (!apply) return { decks, rows, contentVersion };
  const url = process.env.SUPABASE_URL?.replace(/\/$/u, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  await upsert('vocabulary_decks', decks, 'slug', url, key);
  await upsert('vocabulary_deck_cards', rows, 'deck_slug,card_id', url, key);
  return { decks, rows, contentVersion };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run();
