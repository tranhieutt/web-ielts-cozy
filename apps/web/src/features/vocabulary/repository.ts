/**
 * The Vocabulary data seam.
 *
 * `service.ts` talks to this interface and nothing else, so swapping the
 * fixture for Supabase (VOC-API-02s/03s/05s) changes no business behavior.
 *
 * Every method is async because the real adapter crosses the network. The
 * fixture satisfies the same signatures synchronously-in-a-promise rather than
 * letting the service assume in-process data.
 *
 * WHY `commitReview` IS ONE METHOD: the fixture used to expose
 * `findReplay` / `putLearnerState` / `recordReview` separately, which invites a
 * read-then-write race and cannot be transactional. Persisting the event and
 * the state is one indivisible operation (spec §8.4), so the seam exposes it as
 * one call and each adapter decides how to make it atomic.
 */

import type { LearnerCardState, Rating, SrsState, VocabularyCard } from './types';

export interface DeckRecord {
  slug: string;
  display_name_vi: string;
  publish_status: string;
}

/**
 * A deck plus its card count, WITHOUT the cards.
 *
 * The dashboard needs "how many", never "which ones". Fetching the cards to
 * call `.length` on them made the first screen cost one row per published card
 * — 1,735 rows across four decks, and worse with every deck published after.
 */
export interface DeckSummaryRecord extends DeckRecord {
  publishable_card_count: number;
}

/** Which decks a given set of cards belongs to. */
export interface DeckMembership {
  deck_slug: string;
  card_id: string;
}

/**
 * Raised when the learner's stored state moved between reading it and writing
 * the new one — a second tab, or a retry that overtook its original. The write
 * is refused rather than clobbering the newer state (a lost update).
 *
 * Callers should re-read and let the learner rate again; they must NOT retry
 * blindly with the same expected state, which would just lose the race again.
 */
export class StaleLearnerStateError extends Error {}

/** The card id does not exist in the catalog. */
export class UnknownCardError extends Error {}

export interface CommitReviewInput {
  learnerId: string;
  cardId: string;
  rating: Rating;
  /** Must be a UUID: the `learner_card_reviews.idempotency_key` column is `uuid`. */
  idempotencyKey: string;
  reviewedAt: Date;
  /**
   * The state this transition was computed FROM. It is a compare-and-swap
   * guard, not a historical note: the write only applies if the stored state
   * still matches, otherwise `StaleLearnerStateError`.
   */
  expected: { state: SrsState; stage: number | null };
  next: { state: SrsState; stage: number; dueAt: string };
}

export interface CommitReviewOutcome {
  /** The PERSISTED outcome. On replay this is the first write, not the new computation. */
  state: SrsState;
  stage: number;
  dueAt: string;
  /** True when `idempotencyKey` had already been used and nothing advanced. */
  replayed: boolean;
}

export interface VocabularyRepository {
  listDecks(): Promise<DeckRecord[]>;
  listDeckSummaries(): Promise<DeckSummaryRecord[]>;
  /**
   * Memberships for specific cards only. Callers pass the learner's rated
   * cards, so this scales with how much a learner has studied rather than with
   * the size of the catalog.
   */
  listDeckMemberships(cardIds: string[]): Promise<DeckMembership[]>;
  listPublishableCards(deckSlug: string): Promise<VocabularyCard[]>;
  findCard(cardId: string): Promise<VocabularyCard | undefined>;
  getLearnerStates(learnerId: string): Promise<LearnerCardState[]>;
  commitReview(input: CommitReviewInput): Promise<CommitReviewOutcome>;
}
