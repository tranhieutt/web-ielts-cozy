/**
 * VOC-DATA-07b — publish the beta deck list.
 *
 * Publishing is TWO flips, not one. RLS defines publishable as
 * "card published AND deck published" (spec §4), so flipping only the deck
 * shows an empty deck and flipping only the cards shows nothing at all.
 *
 * Scope is deliberately narrow: only cards that belong to a beta deck are
 * published. Those cards are also members of other decks, but publishing a card
 * does not leak it into a draft deck — RLS on `vocabulary_deck_cards` requires
 * the deck to be published too.
 *
 * Idempotent: re-running changes nothing once the target state is reached.
 * Reversible: `--unpublish` puts both back to `draft`, which is the rollback
 * step referenced by the release runbook.
 *
 *   node ./scripts/vocabulary/publish-beta-decks.mjs            # dry run
 *   node ./scripts/vocabulary/publish-beta-decks.mjs --apply
 *   node ./scripts/vocabulary/publish-beta-decks.mjs --apply --unpublish
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The beta list decided under VOC-PLAN-02 (2026-08-21). Changing this list is a
 * product decision, not a code cleanup — update the execution plan too.
 */
export const BETA_DECKS = ['general_academic', 'environment', 'technology', 'education'];

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const match = raw.trim().match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, '');
    }
  }
}

/** PostgREST cannot express "update where id in (subquery)", so both flips go through PATCH filters. */
async function patch(table, filter, body, { supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  const response = await fetchImpl(`${supabaseUrl}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation,count=exact',
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`${table} update failed (HTTP ${response.status}): ${await response.text()}`);
  }
  const rows = await response.json();
  return rows.length;
}

/**
 * Reads every membership row for the beta decks.
 *
 * Paginated deliberately: PostgREST caps an unbounded select at 1,000 rows, and
 * the beta list has ~1,735 memberships. Taking the first page would publish a
 * silently truncated subset — decks that look published but are missing cards.
 */
async function cardIdsInBetaDecks(config) {
  const list = BETA_DECKS.map((slug) => `"${slug}"`).join(',');
  const doFetch = config.fetchImpl ?? fetch;
  const PAGE = 1000;
  const ids = new Set();

  for (let offset = 0; ; offset += PAGE) {
    const response = await doFetch(
      `${config.supabaseUrl}/rest/v1/vocabulary_deck_cards?select=card_id&deck_slug=in.(${list})&order=card_id.asc`,
      {
        headers: {
          apikey: config.serviceRoleKey,
          authorization: `Bearer ${config.serviceRoleKey}`,
          range: `${offset}-${offset + PAGE - 1}`,
        },
      },
    );
    if (!response.ok) {
      throw new Error(`membership read failed (HTTP ${response.status}): ${await response.text()}`);
    }
    const rows = await response.json();
    for (const row of rows) ids.add(row.card_id);
    if (rows.length < PAGE) break;
  }

  return [...ids];
}

export async function run(args = process.argv.slice(2)) {
  loadEnv(resolve(join(ROOT, '.env.local')));

  const apply = args.includes('--apply');
  const unpublish = args.includes('--unpublish');
  const target = unpublish ? 'draft' : 'published';

  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/u, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }
  const config = { supabaseUrl, serviceRoleKey };

  const cardIds = await cardIdsInBetaDecks(config);

  console.log(
    JSON.stringify({ decks: BETA_DECKS, cards: cardIds.length, target, apply }, null, 2),
  );
  if (!apply) return { decks: BETA_DECKS.length, cards: cardIds.length, applied: false };

  const deckFilter = `slug=in.(${BETA_DECKS.map((slug) => `"${slug}"`).join(',')})`;
  const decksChanged = await patch(
    'vocabulary_decks',
    deckFilter,
    { publish_status: target },
    config,
  );

  // Chunked: a URL carrying 1,600 ids at once exceeds what the gateway accepts.
  let cardsChanged = 0;
  for (let index = 0; index < cardIds.length; index += 200) {
    const chunk = cardIds.slice(index, index + 200);
    cardsChanged += await patch(
      'vocabulary_cards',
      `id=in.(${chunk.map((id) => `"${id}"`).join(',')})`,
      { content_status: target },
      config,
    );
  }

  console.log(JSON.stringify({ decksChanged, cardsChanged, target }, null, 2));
  return { decks: decksChanged, cards: cardsChanged, applied: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run();
