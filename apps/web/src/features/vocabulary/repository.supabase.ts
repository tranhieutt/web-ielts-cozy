/**
 * Supabase-backed data adapter (VOC-API-02s / 03s / 05s).
 *
 * Talks to PostgREST over `fetch`, matching the importer scripts, so the app
 * pulls in no Supabase SDK.
 *
 * SECURITY — read this before changing anything here:
 * - Learner reads and writes go out with the LEARNER'S access token, so every
 *   RLS policy applies and `auth.uid()` is the learner. There is deliberately
 *   no service-role path: a service-role key would bypass RLS and turn one
 *   compromised request into every learner's data.
 * - Content reads (decks, cards) use the publishable key only. Those tables are
 *   readable by `anon` for published rows and nothing else.
 * - A missing access token is an error, never a silent downgrade to anon.
 *
 * DURABILITY: `commitReview` is a single `submit_vocabulary_review` RPC, so the
 * review event and the learner state commit or roll back together and a
 * replayed `idempotencyKey` returns the first write (spec §8.4).
 */

import {
  StaleLearnerStateError,
  UnknownCardError,
  type CommitReviewInput,
  type DeckMembership,
  type DeckSummaryRecord,
  type CommitReviewOutcome,
  type DeckRecord,
  type VocabularyRepository,
} from './repository.ts';
import type { LearnerCardState, SrsState, VocabularyCard } from './types';

export interface SupabaseRepositoryConfig {
  url: string;
  publishableKey: string;
  /**
   * The learner's Supabase access token. VOC-API-01 supplies this; until it
   * lands there is no legitimate caller, which is why there is no default.
   */
  accessToken: string;
  fetchImpl?: typeof fetch;
}

/** Columns the learner payload needs. Never `select=*`: it would leak `source_version` and audio paths. */
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

/**
 * Database row -> learner card. The database keeps `primary_topic`/`sort_order`;
 * the learner contract says `topic`/`order`. Mapping lives here so the rest of
 * the feature never learns two names for one thing.
 */
function toCard(row: CardRow): VocabularyCard {
  const card: VocabularyCard = {
    schema_version: 'vocabulary-card/1',
    id: row.id,
    word: row.word,
    is_phrase: row.is_phrase,
    topic: row.primary_topic,
    topics_all: row.topics_all ?? [],
    order: row.sort_order,
    senses: row.senses,
  };
  if (row.cefr) card.cefr = row.cefr;
  if (row.target_band) card.target_band = row.target_band;
  if (row.phonetic) card.phonetic = row.phonetic;
  if (row.examples) card.examples = row.examples;
  if (row.collocations) card.collocations = row.collocations;
  return card;
}

interface StateRow {
  card_id: string;
  state: SrsState;
  stage: number | null;
  due_at: string | null;
  first_seen_at: string | null;
  last_reviewed_at: string | null;
  review_count: number;
}

function toState(learnerId: string, row: StateRow): LearnerCardState {
  return {
    learnerId,
    cardId: row.card_id,
    state: row.state,
    stage: row.stage,
    dueAt: row.due_at,
    firstSeenAt: row.first_seen_at,
    lastReviewedAt: row.last_reviewed_at,
    reviewCount: row.review_count,
  };
}

export class SupabaseRepositoryError extends Error {}

/** Carries the HTTP status so RPC error codes can be classified, not string-matched blindly. */
class SupabaseRequestError extends SupabaseRepositoryError {
  // Written out rather than declared as constructor parameter properties:
  // Node's type-stripping runs the tests and does not support that syntax.
  status: number;
  body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export function createSupabaseRepository(config: SupabaseRepositoryConfig): VocabularyRepository {
  const baseUrl = config.url.replace(/\/$/u, '');
  const doFetch = config.fetchImpl ?? fetch;

  if (!config.accessToken) {
    throw new SupabaseRepositoryError(
      'a learner access token is required: this adapter never falls back to anon or service-role',
    );
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await doFetch(`${baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: config.publishableKey,
        authorization: `Bearer ${config.accessToken}`,
        'content-type': 'application/json',
        ...init.headers,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      // The body can echo learner rows, so it never reaches the client — only the log.
      const detail = await response.text().catch(() => '');
      throw new SupabaseRequestError(
        `supabase ${init.method ?? 'GET'} ${path} failed: ${response.status} ${detail.slice(0, 300)}`,
        response.status,
        detail,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * The learner id is taken from the token by RLS, so it is never sent as a
   * filter. Trusting a client-supplied `learner_id` here would be the exact
   * hole RLS exists to close.
   */
  return {
    async listDecks(): Promise<DeckRecord[]> {
      return request<DeckRecord[]>(
        'vocabulary_decks?select=slug,display_name_vi,publish_status&publish_status=eq.published&order=slug',
      );
    },

    /**
     * Counts come from `vocabulary_deck_summary`, a `security_invoker` view, so
     * the aggregation happens in Postgres with RLS still applied and the wire
     * carries one row per deck instead of one per card.
     */
    async listDeckSummaries(): Promise<DeckSummaryRecord[]> {
      return request<DeckSummaryRecord[]>(
        'vocabulary_deck_summary?select=slug,display_name_vi,publish_status,publishable_card_count' +
          '&publish_status=eq.published&order=slug',
      );
    },

    async listDeckMemberships(cardIds: string[]): Promise<DeckMembership[]> {
      if (cardIds.length === 0) return [];
      const list = cardIds.map((id) => `"${id}"`).join(',');
      return request<DeckMembership[]>(
        `vocabulary_deck_cards?select=deck_slug,card_id&card_id=in.(${encodeURIComponent(list)})`,
      );
    },

    async listPublishableCards(deckSlug: string): Promise<VocabularyCard[]> {
      // Inner join through the membership table: RLS already hides unpublished
      // decks and cards, so a draft deck comes back as an empty list.
      const rows = await request<Array<{ vocabulary_cards: CardRow }>>(
        `vocabulary_deck_cards?select=vocabulary_cards!inner(${CARD_COLUMNS})` +
          `&deck_slug=eq.${encodeURIComponent(deckSlug)}&order=position.asc`,
      );
      return rows.map((row) => toCard(row.vocabulary_cards));
    },

    async findCard(cardId: string): Promise<VocabularyCard | undefined> {
      const rows = await request<CardRow[]>(
        `vocabulary_cards?select=${CARD_COLUMNS}&id=eq.${encodeURIComponent(cardId)}&limit=1`,
      );
      return rows[0] ? toCard(rows[0]) : undefined;
    },

    async getLearnerStates(learnerId: string): Promise<LearnerCardState[]> {
      const rows = await request<StateRow[]>(
        'learner_card_states?select=card_id,state,stage,due_at,first_seen_at,last_reviewed_at,review_count',
      );
      return rows.map((row) => toState(learnerId, row));
    },

    async commitReview(input: CommitReviewInput): Promise<CommitReviewOutcome> {
      // Parameter names and the returned column names are fixed by the
      // deployed `submit_vocabulary_review`; see the migration history under
      // supabase/migrations. Do not "tidy" them without changing the function.
      let rows: Array<{
        result_card_id: string;
        result_state: SrsState;
        result_stage: number;
        result_due_at: string;
        replayed: boolean;
      }>;

      try {
        rows = await request('rpc/submit_vocabulary_review', {
          method: 'POST',
          body: JSON.stringify({
            p_card_id: input.cardId,
            p_rating: input.rating,
            p_idempotency_key: input.idempotencyKey,
            p_reviewed_at: input.reviewedAt.toISOString(),
            p_expected_state: input.expected.state,
            p_expected_stage: input.expected.stage,
            p_next_state: input.next.state,
            p_next_stage: input.next.stage,
            p_next_due_at: input.next.dueAt,
          }),
        });
      } catch (error) {
        // PT409/PT404 are raised by the function with those SQLSTATEs precisely
        // so PostgREST maps them to real HTTP statuses. PT409 is deliberately
        // not 40001: PostgREST auto-retries serialization_failure, which turns
        // one lost race into an unbounded retry loop.
        if (error instanceof SupabaseRequestError) {
          if (error.status === 409) {
            throw new StaleLearnerStateError(
              `learner state for ${input.cardId} moved since it was read; the rating was not applied`,
            );
          }
          if (error.status === 404) {
            throw new UnknownCardError(`unknown card: ${input.cardId}`);
          }
        }
        throw error;
      }

      const row = rows[0];
      if (!row) {
        throw new SupabaseRepositoryError('submit_vocabulary_review returned no row');
      }

      return {
        state: row.result_state,
        stage: row.result_stage,
        // Postgres renders timestamptz its own way; normalise so the API contract
        // is one ISO shape whichever adapter answered.
        dueAt: new Date(row.result_due_at).toISOString(),
        replayed: row.replayed,
      };
    },
  };
}
