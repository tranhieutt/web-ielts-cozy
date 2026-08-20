/**
 * Content source selector.
 *
 * `VOCABULARY_CONTENT_SOURCE=supabase` serves the real catalog behind RLS;
 * anything else serves the checked-in 20-card Environment fixture, which is
 * what tests and offline development use. Both adapters expose the same three
 * reads, so `service.ts` never learns which one answered.
 */

import * as fixture from './repository.fixture.ts';
import * as supabase from './repository.supabase.ts';
import type { VocabularyCard } from './types.ts';

export interface DeckSummaryRecord {
  slug: string;
  displayNameVi: string;
  publishStatus: string;
  publishableCardCount: number;
}

function useSupabase(): boolean {
  return process.env.VOCABULARY_CONTENT_SOURCE === 'supabase';
}

/** Deck catalog with counts. One request against Supabase; local for fixture. */
export async function listDeckSummaries(): Promise<DeckSummaryRecord[]> {
  if (useSupabase()) {
    const rows = await supabase.listDeckSummaries();
    return rows.map((row) => ({
      slug: row.slug,
      displayNameVi: row.display_name_vi,
      publishStatus: row.publish_status,
      publishableCardCount: row.publishable_card_count,
    }));
  }

  return fixture.listDecks().map((deck) => ({
    slug: deck.slug,
    displayNameVi: deck.display_name_vi,
    publishStatus: deck.publish_status,
    publishableCardCount: fixture.listPublishableCards(deck.slug).length,
  }));
}

export async function listPublishableCards(deckSlug: string): Promise<VocabularyCard[]> {
  return useSupabase()
    ? supabase.listPublishableCards(deckSlug)
    : fixture.listPublishableCards(deckSlug);
}

export async function findCards(cardIds: string[]): Promise<VocabularyCard[]> {
  if (useSupabase()) return supabase.findCards(cardIds);
  return cardIds
    .map((id) => fixture.findCard(id))
    .filter((card): card is VocabularyCard => card !== undefined);
}

export async function findCard(cardId: string): Promise<VocabularyCard | undefined> {
  return useSupabase() ? supabase.findCard(cardId) : fixture.findCard(cardId);
}
