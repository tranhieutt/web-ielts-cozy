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
 * - `commitReview` is atomic only because a single Node process runs one
 *   callback at a time. That is not a transaction and does not survive scaling.
 * - It does enforce the same compare-and-swap on learner state as the deployed
 *   `submit_vocabulary_review`, so both adapters reject a stale write alike.
 *
 * The seam it implements is `VocabularyRepository` in `repository.ts`.
 */

import fixture from './fixtures/environment-slice.json' with { type: 'json' };
import {
  StaleLearnerStateError,
  UnknownCardError,
  type CommitReviewInput,
  type CommitReviewOutcome,
  type DeckMembership,
  type DeckRecord,
  type DeckSummaryRecord,
  type VocabularyRepository,
} from './repository.ts';
import type { LearnerCardState, VocabularyCard } from './types';

const cards = fixture.cards as VocabularyCard[];
const cardsById = new Map(cards.map((card) => [card.id, card]));

/**
 * Publishable = card published AND its deck published (spec §4). The fixture
 * deck is published and every fixture card passed the content gate, so all
 * cards here are publishable; the check stays explicit so the rule does not
 * quietly disappear alongside the Supabase adapter.
 */
const deckIsPublished = fixture.deck.publish_status === 'published';

const learnerStates = new Map<string, LearnerCardState>();
/** Stands in for the unique `(learner_id, idempotency_key)` constraint. */
const idempotencyLog = new Map<string, CommitReviewOutcome>();

const stateKey = (learnerId: string, cardId: string) => `${learnerId}::${cardId}`;

export function createFixtureRepository(): VocabularyRepository {
  return {
    async listDecks(): Promise<DeckRecord[]> {
      return deckIsPublished ? [fixture.deck as DeckRecord] : [];
    },

    async listDeckSummaries(): Promise<DeckSummaryRecord[]> {
      if (!deckIsPublished) return [];
      return [{ ...(fixture.deck as DeckRecord), publishable_card_count: cards.length }];
    },

    async listDeckMemberships(cardIds: string[]): Promise<DeckMembership[]> {
      if (!deckIsPublished) return [];
      return cardIds
        .filter((id) => cardsById.has(id))
        .map((id) => ({ deck_slug: fixture.deck.slug, card_id: id }));
    },

    async listPublishableCards(deckSlug: string): Promise<VocabularyCard[]> {
      if (!deckIsPublished || deckSlug !== fixture.deck.slug) return [];
      return cards;
    },

    async findCard(cardId: string): Promise<VocabularyCard | undefined> {
      return cardsById.get(cardId);
    },

    async getLearnerStates(learnerId: string): Promise<LearnerCardState[]> {
      return [...learnerStates.values()].filter((state) => state.learnerId === learnerId);
    },

    async commitReview(input: CommitReviewInput): Promise<CommitReviewOutcome> {
      const replayKey = `${input.learnerId}::${input.idempotencyKey}`;
      const replay = idempotencyLog.get(replayKey);
      if (replay) return { ...replay, replayed: true };

      // Checked here, not in the service, so both adapters resolve an unknown
      // card at the same point: inside the write.
      if (!cardsById.has(input.cardId)) {
        throw new UnknownCardError(`unknown card: ${input.cardId}`);
      }

      const key = stateKey(input.learnerId, input.cardId);
      const current = learnerStates.get(key);

      // Same compare-and-swap rule the deployed function enforces. A single
      // Node process makes losing this race unlikely, but the seam must behave
      // identically in both adapters or tests written here would not mean
      // anything about production.
      const storedState = current?.state ?? 'new';
      const storedStage = current?.stage ?? null;
      if (storedState !== input.expected.state || storedStage !== input.expected.stage) {
        throw new StaleLearnerStateError(
          `learner state for ${input.cardId} moved since it was read; the rating was not applied`,
        );
      }

      const reviewedAtIso = input.reviewedAt.toISOString();

      learnerStates.set(key, {
        learnerId: input.learnerId,
        cardId: input.cardId,
        state: input.next.state,
        stage: input.next.stage,
        dueAt: input.next.dueAt,
        firstSeenAt: current?.firstSeenAt ?? reviewedAtIso,
        lastReviewedAt: reviewedAtIso,
        reviewCount: (current?.reviewCount ?? 0) + 1,
      });

      const outcome: CommitReviewOutcome = {
        state: input.next.state,
        stage: input.next.stage,
        dueAt: input.next.dueAt,
        replayed: false,
      };
      idempotencyLog.set(replayKey, outcome);
      return outcome;
    },
  };
}

/** Test-only: the real adapter has no such thing. */
export function resetFixtureState(): void {
  learnerStates.clear();
  idempotencyLog.clear();
}
