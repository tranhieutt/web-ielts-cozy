export type SrsState = 'new' | 'learning' | 'review' | 'mastered';
export type Rating = 'again' | 'known';
export type QueueMode = 'due' | 'new';

export interface VocabularySense {
  pos?: string;
  def_vi: string;
  def_en?: string;
}

export interface VocabularyCard {
  schema_version: string;
  id: string;
  word: string;
  is_phrase: boolean;
  topic: string;
  topics_all: string[];
  order: number;
  cefr?: string;
  target_band?: string;
  phonetic?: { uk?: string; us?: string };
  senses: VocabularySense[];
  examples?: Array<{ en: string; vi?: string }>;
  collocations?: Array<{ en: string; vi?: string }>;
}

export interface LearnerCardState {
  learnerId: string;
  cardId: string;
  state: SrsState;
  stage: number | null;
  dueAt: string | null;
  firstSeenAt: string | null;
  lastReviewedAt: string | null;
  reviewCount: number;
}

export interface ReviewResult {
  cardId: string;
  state: SrsState;
  stage: number;
  dueAt: string;
  intervalMinutes: number;
  replayed: boolean;
}

export interface DeckSummary {
  slug: string;
  displayNameVi: string;
  publishableCardCount: number;
  dueCount: number;
  progress: { newCount: number; learningCount: number; masteredCount: number };
}

export interface LearnerProgress {
  /** Cards the learner has rated at least once, across every deck. */
  reviewedCount: number;
  learningCount: number;
  masteredCount: number;
  /** Cards due right now — drives "số thẻ còn đến hạn" on the summary screen. */
  dueCount: number;
  /** Cards already rated whose next review is still in the future. */
  scheduledCount: number;
  decks: DeckSummary[];
}
