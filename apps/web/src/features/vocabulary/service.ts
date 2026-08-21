/**
 * Vocabulary business behavior: deck catalog, review queue, review submission.
 *
 * The SRS schedule itself lives in `srs/transition.mjs` and the in-session
 * ordering in `srs/session-queue.mjs`; this module only orchestrates them
 * around the data adapter.
 */

import { resolveAudioSources } from './audio.ts';
import { STAGE_INTERVAL_MINUTES, transitionVocabularySrs } from './srs/transition.mjs';
import type { VocabularyRepository } from './repository';
import type {
  DeckSummary,
  LearnerProgress,
  LearnerCardState,
  QueueMode,
  Rating,
  ReviewResult,
  VocabularyCard,
  VocabularyCardPayload,
} from './types';

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Attach audio only when the release gate is open (ADR-003). */
function toPayload(card: VocabularyCard): VocabularyCardPayload {
  const audio = resolveAudioSources(card.id);
  return audio ? { ...card, audio } : card;
}

function cefrRank(card: VocabularyCard): number {
  const index = card.cefr ? CEFR_ORDER.indexOf(card.cefr) : -1;
  // Uncategorised cards sort last rather than pretending to be A1.
  return index === -1 ? CEFR_ORDER.length : index;
}

/**
 * Deck catalog for the dashboard (spec §6.1).
 *
 * Cost is proportional to how much the LEARNER has studied, not to how big the
 * catalog is. Totals come from a database-side count, and only the learner's
 * own rated cards are mapped back to decks. The earlier version fetched every
 * card of every published deck purely to call `.length` on the array, which put
 * the whole published corpus on the wire for the first screen a learner sees.
 */
export async function getDeckCatalog(
  repository: VocabularyRepository,
  learnerId: string,
): Promise<DeckSummary[]> {
  const now = Date.now();
  const states = await repository.getLearnerStates(learnerId);

  const memberships = await repository.listDeckMemberships(states.map((s) => s.cardId));
  const statesByCard = new Map(states.map((s) => [s.cardId, s]));

  // deck slug -> the learner's states for cards in that deck.
  const perDeck = new Map<string, LearnerCardState[]>();
  for (const membership of memberships) {
    const state = statesByCard.get(membership.card_id);
    if (!state) continue;
    const bucket = perDeck.get(membership.deck_slug);
    if (bucket) bucket.push(state);
    else perDeck.set(membership.deck_slug, [state]);
  }

  return (await repository.listDeckSummaries()).map((deck) => {
    let dueCount = 0;
    let learningCount = 0;
    let masteredCount = 0;

    for (const state of perDeck.get(deck.slug) ?? []) {
      if (state.state === 'mastered') masteredCount += 1;
      else if (state.state !== 'new') learningCount += 1;
      if (state.dueAt !== null && Date.parse(state.dueAt) <= now) dueCount += 1;
    }

    return {
      slug: deck.slug,
      displayNameVi: deck.display_name_vi,
      publishableCardCount: deck.publishable_card_count,
      dueCount,
      progress: {
        newCount: deck.publishable_card_count - (learningCount + masteredCount),
        learningCount,
        masteredCount,
      },
    };
  });
}

/**
 * Build a NEW session queue. `due_at` is read only here (spec §8.3); once the
 * session runs, ordering belongs to `session-queue.mjs` and never comes back
 * to this function.
 */
export async function buildReviewQueue(
  repository: VocabularyRepository,
  learnerId: string,
  { deck, mode, limit }: { deck: string; mode: QueueMode; limit: number },
): Promise<VocabularyCardPayload[]> {
  const now = Date.now();
  const cards = await repository.listPublishableCards(deck);
  const states = new Map(
    (await repository.getLearnerStates(learnerId)).map((s) => [s.cardId, s]),
  );

  if (mode === 'new') {
    // Cards never seen, easiest CEFR first, `order` then `id` as stable tiebreak.
    return cards
      .filter((card) => !states.has(card.id))
      .sort((a, b) => cefrRank(a) - cefrRank(b) || a.order - b.order || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(toPayload);
  }

  // due: most overdue first, then soonest due, then learning cards.
  const due: Array<{ card: VocabularyCard; state: LearnerCardState; dueAt: number }> = [];
  for (const card of cards) {
    const state = states.get(card.id);
    if (!state || state.dueAt === null) continue;
    const dueAt = Date.parse(state.dueAt);
    if (dueAt <= now) due.push({ card, state, dueAt });
  }

  return due
    .sort((a, b) => a.dueAt - b.dueAt || a.card.order - b.card.order)
    .slice(0, limit)
    .map((entry) => toPayload(entry.card));
}

/**
 * Submit one rating.
 *
 * The schedule is computed HERE from the learner's current state, then handed
 * to the adapter to persist as one unit. A repeated `idempotencyKey` replays
 * the FIRST persisted result instead of advancing a second stage (spec §8.4) —
 * and that decision is made by the adapter's uniqueness constraint, not by a
 * read-then-write check in this function, so a double-tap retry cannot race.
 *
 * The state we read is also sent as `expected`, making the write a
 * compare-and-swap. If a concurrent session moved the card first, the adapter
 * raises `StaleLearnerStateError` rather than overwriting the newer state with
 * a schedule computed from a stale one.
 */
export async function submitReview(
  repository: VocabularyRepository,
  learnerId: string,
  {
    cardId,
    rating,
    idempotencyKey,
    reviewedAt = new Date(),
  }: { cardId: string; rating: Rating; idempotencyKey: string; reviewedAt?: Date },
): Promise<ReviewResult> {
  // No existence pre-check here on purpose. The adapter checks the card inside
  // the same transaction that writes, so a check up here would be an extra
  // round trip AND a TOCTOU gap: the card could be unpublished between the two.
  const states = await repository.getLearnerStates(learnerId);
  const current: Pick<LearnerCardState, 'state' | 'stage'> = states.find(
    (entry) => entry.cardId === cardId,
  ) ?? { state: 'new', stage: null };

  const next = transitionVocabularySrs(
    { state: current.state, stage: current.stage },
    rating,
    reviewedAt,
  );

  const persisted = await repository.commitReview({
    learnerId,
    cardId,
    rating,
    idempotencyKey,
    reviewedAt,
    expected: { state: current.state, stage: current.stage },
    next: { state: next.state, stage: next.stage, dueAt: next.dueAt },
  });

  return {
    cardId,
    state: persisted.state,
    stage: persisted.stage,
    dueAt: persisted.dueAt,
    // Derived from the PERSISTED stage, so a replay reports the interval that
    // was actually scheduled rather than the one this call recomputed.
    intervalMinutes: STAGE_INTERVAL_MINUTES[persisted.stage as keyof typeof STAGE_INTERVAL_MINUTES],
    replayed: persisted.replayed,
  };
}

/**
 * Learner totals for the dashboard and the session summary (spec §6.3).
 *
 * `reviewedCount` counts cards the learner has actually rated — never cards
 * merely seen — so it cannot be mistaken for "đã thuộc" (spec §6.1).
 */
export async function getLearnerProgress(
  repository: VocabularyRepository,
  learnerId: string,
): Promise<LearnerProgress> {
  const now = Date.now();
  const states = await repository.getLearnerStates(learnerId);

  let learningCount = 0;
  let masteredCount = 0;
  let dueCount = 0;
  let scheduledCount = 0;

  for (const state of states) {
    if (state.state === 'mastered') masteredCount += 1;
    else if (state.state !== 'new') learningCount += 1;

    if (state.dueAt === null) continue;
    if (Date.parse(state.dueAt) <= now) dueCount += 1;
    else scheduledCount += 1;
  }

  return {
    reviewedCount: states.length,
    learningCount,
    masteredCount,
    dueCount,
    scheduledCount,
    decks: await getDeckCatalog(repository, learnerId),
  };
}
