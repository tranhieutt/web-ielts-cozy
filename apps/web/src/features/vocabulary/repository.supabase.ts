/**
 * Supabase content adapter (VOC-API-02s / VOC-API-03s).
 *
 * Reads go through PostgREST with the PUBLISHABLE key, never the service-role
 * key, so Row Level Security is what decides visibility. The policies already
 * encode the spec's publishable rule — a deck row is readable only when
 * `publish_status = 'published'`, and a membership row only when its deck AND
 * its card are both published — which means this module cannot accidentally
 * widen the learner-visible set even if it asks for more.
 *
 * Content is immutable per release, so responses are cached per process. This
 * is the seam that `repository.fixture.ts` also implements; `service.ts` never
 * learns which one is in use.
 */

import type { VocabularyCard } from './types';

const PAGE_SIZE = 1000;

interface DeckSummaryRow {
  slug: string;
  display_name_vi: string;
  publish_status: string;
  publishable_card_count: number;
}

function config() {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/+$/, '');
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required when VOCABULARY_CONTENT_SOURCE=supabase',
    );
  }
  return { url, key };
}

async function restGet<T>(path: string): Promise<T[]> {
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    // Content changes only on release, never per request.
    cache: 'force-cache',
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as T[];
}

/** PostgREST caps rows per request, so walk pages until one comes back short. */
async function restGetAll<T>(build: (offset: number) => string): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await restGet<T>(build(offset));
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

const CARD_COLUMNS = [
  'id',
  'word',
  'is_phrase',
  'primary_topic',
  'topics_all',
  'sort_order',
  'cefr',
  'target_band',
  'phonetic',
  'senses',
  'examples',
  'collocations',
].join(',');

interface CardRow {
  id: string;
  word: string;
  is_phrase: boolean;
  primary_topic: string;
  topics_all: string[] | null;
  sort_order: number;
  cefr: string | null;
  target_band: string | null;
  phonetic: { uk?: string; us?: string } | null;
  senses: VocabularyCard['senses'];
  examples: VocabularyCard['examples'] | null;
  collocations: VocabularyCard['collocations'] | null;
}

function toCard(row: CardRow): VocabularyCard {
  return {
    schema_version: 'vocabulary-card.v1',
    id: row.id,
    word: row.word,
    is_phrase: row.is_phrase,
    topic: row.primary_topic,
    topics_all: row.topics_all ?? [row.primary_topic],
    order: row.sort_order,
    ...(row.cefr ? { cefr: row.cefr } : {}),
    ...(row.target_band ? { target_band: row.target_band } : {}),
    ...(row.phonetic && (row.phonetic.uk || row.phonetic.us) ? { phonetic: row.phonetic } : {}),
    senses: row.senses,
    ...(row.examples?.length ? { examples: row.examples } : {}),
    ...(row.collocations?.length ? { collocations: row.collocations } : {}),
  };
}

let summaryCache: Promise<DeckSummaryRow[]> | null = null;
const deckCardCache = new Map<string, Promise<VocabularyCard[]>>();
const cardCache = new Map<string, VocabularyCard>();

/**
 * Whole catalog in ONE request.
 *
 * Round-trip latency to the project is ~600ms while the count itself runs in
 * ~2ms, so the cost that matters is the number of requests. `vocabulary_deck_summary`
 * is a `security_invoker` view, so RLS still hides unpublished decks and cards.
 */
export async function listDeckSummaries(): Promise<DeckSummaryRow[]> {
  summaryCache ??= restGet<DeckSummaryRow>(
    'vocabulary_deck_summary?select=slug,display_name_vi,publish_status,publishable_card_count&order=slug',
  );
  return summaryCache;
}

export async function listPublishableCards(deckSlug: string): Promise<VocabularyCard[]> {
  let cached = deckCardCache.get(deckSlug);
  if (!cached) {
    cached = restGetAll<{ position: number; vocabulary_cards: CardRow | null }>(
      (offset) =>
        `vocabulary_deck_cards?select=position,vocabulary_cards(${CARD_COLUMNS})` +
        `&deck_slug=eq.${encodeURIComponent(deckSlug)}` +
        `&order=position&limit=${PAGE_SIZE}&offset=${offset}`,
    ).then((rows) =>
      rows
        // RLS hides memberships whose card is not published; the join then
        // yields null, which must be dropped rather than rendered as a blank.
        .map((row) => row.vocabulary_cards)
        .filter((row): row is CardRow => row !== null)
        .map(toCard),
    );
    deckCardCache.set(deckSlug, cached);
  }

  const cards = await cached;
  for (const card of cards) cardCache.set(card.id, card);
  return cards;
}

export async function findCards(cardIds: string[]): Promise<VocabularyCard[]> {
  if (cardIds.length === 0) return [];

  const missing = cardIds.filter((id) => !cardCache.has(id));
  if (missing.length > 0) {
    const list = missing.map((id) => `"${id}"`).join(',');
    const rows = await restGet<CardRow>(
      `vocabulary_cards?select=${CARD_COLUMNS}&id=in.(${encodeURIComponent(list)})`,
    );
    for (const row of rows) {
      const card = toCard(row);
      cardCache.set(card.id, card);
    }
  }

  return cardIds.map((id) => cardCache.get(id)).filter((card): card is VocabularyCard => !!card);
}

export async function findCard(cardId: string): Promise<VocabularyCard | undefined> {
  const cached = cardCache.get(cardId);
  if (cached) return cached;

  const rows = await restGet<CardRow>(
    `vocabulary_cards?select=${CARD_COLUMNS}&id=eq.${encodeURIComponent(cardId)}&limit=1`,
  );
  if (rows.length === 0) return undefined;

  const card = toCard(rows[0]);
  cardCache.set(card.id, card);
  return card;
}
