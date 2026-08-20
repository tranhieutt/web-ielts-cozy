/**
 * Vocabulary business behavior: deck catalog, review queue, review submission.
 *
 * The SRS schedule itself lives in `srs/transition.mjs` and the in-session
 * ordering in `srs/session-queue.mjs`; this module only orchestrates them
 * around the data adapter.
 */

import { resolveAudioSources } from './audio.ts';
import * as content from './content.ts';
import * as learner from './learner.ts';
import type { LearnerContext } from './learner.ts';
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

export async function getDeckCatalog(ctx: LearnerContext): Promise<DeckSummary[]> {
  const now = Date.now();
  const states = await learner.getLearnerStates(ctx);
  const decks = (await content.listDeckSummaries()).filter(
    (deck) => deck.publishStatus === 'published',
  );
  const published = new Set(decks.map((deck) => deck.slug));

  // Only the cards this learner has actually rated are fetched. Counting a
  // deck must never mean downloading it (spec §12).
  const ratedCards = await content.findCards(states.map((state) => state.cardId));
  // De-duplicated on purpose: `topics_all` already contains `topic`, so a plain
  // concat counts the primary deck twice and inflates every per-deck figure
  // (VOC-03 — one card in several topics is still ONE state per learner).
  const deckOfCard = new Map(
    ratedCards.map((card) => [
      card.id,
      [...new Set([card.topic, ...card.topics_all])].filter((slug) => published.has(slug)),
    ]),
  );

  const perDeck = new Map<string, { due: number; learning: number; mastered: number }>();
  for (const state of states) {
    for (const slug of deckOfCard.get(state.cardId) ?? []) {
      const bucket = perDeck.get(slug) ?? { due: 0, learning: 0, mastered: 0 };
      if (state.state === 'mastered') bucket.mastered += 1;
      else if (state.state !== 'new') bucket.learning += 1;
      if (state.dueAt !== null && Date.parse(state.dueAt) <= now) bucket.due += 1;
      perDeck.set(slug, bucket);
    }
  }

  return Promise.all(
    decks.map(async (deck) => {
      const publishableCardCount = deck.publishableCardCount;
      const bucket = perDeck.get(deck.slug) ?? { due: 0, learning: 0, mastered: 0 };

      return {
        slug: deck.slug,
        displayNameVi: deck.displayNameVi,
        publishableCardCount,
        dueCount: bucket.due,
        progress: {
          newCount: publishableCardCount - (bucket.learning + bucket.mastered),
          learningCount: bucket.learning,
          masteredCount: bucket.mastered,
        },
      };
    }),
  );
}

/**
 * Build a NEW session queue. `due_at` is read only here (spec §8.3); once the
 * session runs, ordering belongs to `session-queue.mjs` and never comes back
 * to this function.
 */
export async function buildReviewQueue(
  ctx: LearnerContext,
  { deck, mode, limit }: { deck: string; mode: QueueMode; limit: number },
): Promise<VocabularyCardPayload[]> {
  const now = Date.now();
  const cards = await content.listPublishableCards(deck);
  const states = new Map((await learner.getLearnerStates(ctx)).map((s) => [s.cardId, s]));

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
 * Submit one rating. State update and review event are one unit of work; a
 * repeated `idempotencyKey` replays the FIRST result instead of advancing a
 * second stage (spec §8.4). Atomicity lives in the adapter, because only the
 * database can provide it.
 */
export async function submitReview(
  ctx: LearnerContext,
  {
    cardId,
    rating,
    idempotencyKey,
    reviewedAt = new Date(),
  }: { cardId: string; rating: Rating; idempotencyKey: string; reviewedAt?: Date },
): Promise<ReviewResult> {
  if (!(await content.findCard(cardId))) {
    throw new Error(`unknown card: ${cardId}`);
  }

  // The previous state is read for the SRS transition only. The adapter reads
  // it again inside the transaction, which is the read that actually decides
  // what is written — this one cannot race anything.
  const states = await learner.getLearnerStates(ctx);
  const current = states.find((state) => state.cardId === cardId);

  const next = transitionVocabularySrs(
    { state: current?.state ?? 'new', stage: current?.stage ?? null },
    rating,
    reviewedAt,
  );

  return learner.submitReview(ctx, { cardId, rating, idempotencyKey, reviewedAt, next });
}

/**
 * Learner totals for the dashboard and the session summary (spec §6.3).
 *
 * `reviewedCount` counts cards the learner has actually rated — never cards
 * merely seen — so it cannot be mistaken for "đã thuộc" (spec §6.1).
 */
export async function getLearnerProgress(ctx: LearnerContext): Promise<LearnerProgress> {
  const now = Date.now();
  const states = await learner.getLearnerStates(ctx);

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
    decks: await getDeckCatalog(ctx),
  };
}
