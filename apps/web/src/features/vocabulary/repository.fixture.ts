/**
 * Fixture-backed data adapter for the Vocabulary vertical slice.
 *
 * WHY THIS EXISTS: the slice must run before `VOC-DATA-07a` seeds Supabase, so
 * content comes from a checked-in fixture built by the canonical normalizer and
 * learner state lives in process memory.
 *
 * LIMITS — do not mistake this for the real repository:
 * - Learner state is LOST on restart, so it does NOT satisfy VOC-07 (durable
 *   progress). Only the Supabase adapter can.
 * - There is no RLS here. Isolation is a plain map lookup by learner id.
 * - Single process only; nothing here survives horizontal scaling.
 *
 * The exported shape is the seam: the Supabase adapter must implement the same
 * functions so `service.ts` does not change when the data source does.
 */

import fixture from './fixtures/environment-slice.json' with { type: 'json' };
import type { LearnerCardState, VocabularyCard } from './types';

const cards = fixture.cards as VocabularyCard[];
const cardsById = new Map(cards.map((card) => [card.id, card]));

/**
 * Publishable = card published AND its deck published (spec §4). The fixture
 * deck is published and every fixture card passed the content gate, so all
 * cards here are publishable; the check stays explicit so the rule does not
 * quietly disappear when the Supabase adapter lands.
 */
const deckIsPublished = fixture.deck.publish_status === 'published';

export function listPublishableCards(deckSlug: string): VocabularyCard[] {
  if (!deckIsPublished || deckSlug !== fixture.deck.slug) return [];
  return cards;
}

export function listDecks() {
  return deckIsPublished ? [fixture.deck] : [];
}

export function findCard(cardId: string): VocabularyCard | undefined {
  return cardsById.get(cardId);
}

const learnerStates = new Map<string, LearnerCardState>();
const idempotencyLog = new Map<string, string>();

const stateKey = (learnerId: string, cardId: string) => `${learnerId}::${cardId}`;

export function getLearnerStates(learnerId: string): LearnerCardState[] {
  return [...learnerStates.values()].filter((state) => state.learnerId === learnerId);
}

export function getLearnerState(learnerId: string, cardId: string): LearnerCardState | undefined {
  return learnerStates.get(stateKey(learnerId, cardId));
}

export function putLearnerState(state: LearnerCardState): void {
  learnerStates.set(stateKey(state.learnerId, state.cardId), state);
}

/** Stands in for the unique `(learner_id, idempotency_key)` constraint. */
export function findReplay(learnerId: string, idempotencyKey: string): string | undefined {
  return idempotencyLog.get(`${learnerId}::${idempotencyKey}`);
}

export function recordReview(learnerId: string, idempotencyKey: string, payload: string): void {
  idempotencyLog.set(`${learnerId}::${idempotencyKey}`, payload);
}

/** Test-only: the real adapter has no such thing. */
export function resetFixtureState(): void {
  learnerStates.clear();
  idempotencyLog.clear();
}
