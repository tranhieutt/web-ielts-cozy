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

export interface DeckRecord {
  slug: string;
  display_name_vi: string;
  publish_status: string;
}

function useSupabase(): boolean {
  return process.env.VOCABULARY_CONTENT_SOURCE === 'supabase';
}

export async function listDecks(): Promise<DeckRecord[]> {
  return useSupabase() ? supabase.listDecks() : fixture.listDecks();
}

export async function listPublishableCards(deckSlug: string): Promise<VocabularyCard[]> {
  return useSupabase()
    ? supabase.listPublishableCards(deckSlug)
    : fixture.listPublishableCards(deckSlug);
}

export async function findCard(cardId: string): Promise<VocabularyCard | undefined> {
  return useSupabase() ? supabase.findCard(cardId) : fixture.findCard(cardId);
}
