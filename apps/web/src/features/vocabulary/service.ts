/**
 * Vocabulary business behavior: deck catalog, review queue, review submission.
 *
 * The SRS schedule itself lives in `srs/transition.mjs` and the in-session
 * ordering in `srs/session-queue.mjs`; this module only orchestrates them
 * around the data adapter.
 */

import { resolveAudioSources } from './audio.ts';
import * as repository from './repository.fixture.ts';
import { transitionVocabularySrs } from './srs/transition.mjs';
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

export function getDeckCatalog(learnerId: string): DeckSummary[] {
  const now = Date.now();
  const states = new Map(repository.getLearnerStates(learnerId).map((s) => [s.cardId, s]));

  return repository.listDecks().map((deck) => {
    const cards = repository.listPublishableCards(deck.slug);
    let dueCount = 0;
    let learningCount = 0;
    let masteredCount = 0;

    for (const card of cards) {
      const state = states.get(card.id);
      if (!state) continue;
      if (state.state === 'mastered') masteredCount += 1;
      else if (state.state !== 'new') learningCount += 1;
      if (state.dueAt !== null && Date.parse(state.dueAt) <= now) dueCount += 1;
    }

    return {
      slug: deck.slug,
      displayNameVi: deck.display_name_vi,
      publishableCardCount: cards.length,
      dueCount,
      progress: {
        newCount: cards.length - (learningCount + masteredCount),
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
export function buildReviewQueue(
  learnerId: string,
  { deck, mode, limit }: { deck: string; mode: QueueMode; limit: number },
): VocabularyCardPayload[] {
  const now = Date.now();
  const cards = repository.listPublishableCards(deck);
  const states = new Map(repository.getLearnerStates(learnerId).map((s) => [s.cardId, s]));

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

function initialState(learnerId: string, cardId: string): LearnerCardState {
  return {
    learnerId,
    cardId,
    state: 'new',
    stage: null,
    dueAt: null,
    firstSeenAt: null,
    lastReviewedAt: null,
    reviewCount: 0,
  };
}

/**
 * Submit one rating. State update and review event are one unit of work; a
 * repeated `idempotencyKey` replays the FIRST result instead of advancing a
 * second stage (spec §8.4).
 */
export function submitReview(
  learnerId: string,
  {
    cardId,
    rating,
    idempotencyKey,
    reviewedAt = new Date(),
  }: { cardId: string; rating: Rating; idempotencyKey: string; reviewedAt?: Date },
): ReviewResult {
  if (!repository.findCard(cardId)) {
    throw new Error(`unknown card: ${cardId}`);
  }

  const replay = repository.findReplay(learnerId, idempotencyKey);
  if (replay !== undefined) {
    return { ...(JSON.parse(replay) as ReviewResult), replayed: true };
  }

  const current = repository.getLearnerState(learnerId, cardId) ?? initialState(learnerId, cardId);
  const next = transitionVocabularySrs(
    { state: current.state, stage: current.stage },
    rating,
    reviewedAt,
  );

  const reviewedAtIso = reviewedAt.toISOString();
  repository.putLearnerState({
    ...current,
    state: next.state,
    stage: next.stage,
    dueAt: next.dueAt,
    firstSeenAt: current.firstSeenAt ?? reviewedAtIso,
    lastReviewedAt: reviewedAtIso,
    reviewCount: current.reviewCount + 1,
  });

  const result: ReviewResult = {
    cardId,
    state: next.state,
    stage: next.stage,
    dueAt: next.dueAt,
    intervalMinutes: next.intervalMinutes,
    replayed: false,
  };
  repository.recordReview(learnerId, idempotencyKey, JSON.stringify({ ...result, replayed: false }));

  return result;
}

/**
 * Learner totals for the dashboard and the session summary (spec §6.3).
 *
 * `reviewedCount` counts cards the learner has actually rated — never cards
 * merely seen — so it cannot be mistaken for "đã thuộc" (spec §6.1).
 */
export function getLearnerProgress(learnerId: string): LearnerProgress {
  const now = Date.now();
  const states = repository.getLearnerStates(learnerId);

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
    decks: getDeckCatalog(learnerId),
  };
}
