/**
 * Boundary validation for the Vocabulary API (AGENTS.md: validate input at
 * server boundaries). Hand-written rather than schema-library based so the
 * slice adds no dependency before `packages/contracts` exists.
 */

import type { QueueMode, Rating } from './types';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseQueueRequest(params: URLSearchParams): {
  deck: string;
  mode: QueueMode;
  limit: number;
} {
  const deck = params.get('deck')?.trim();
  if (!deck) throw new ValidationError('deck is required');

  const mode = params.get('mode') ?? 'due';
  if (mode !== 'due' && mode !== 'new') {
    throw new ValidationError("mode must be 'due' or 'new'");
  }

  const rawLimit = params.get('limit');
  // Server-side cap (VOC-API-03): the client cannot ask for the whole corpus.
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ValidationError('limit must be an integer between 1 and 50');
  }

  return { deck, mode, limit };
}

export function parseReviewRequest(body: unknown): {
  cardId: string;
  rating: Rating;
  idempotencyKey: string;
} {
  if (typeof body !== 'object' || body === null) {
    throw new ValidationError('request body must be an object');
  }
  const { cardId, rating, idempotencyKey } = body as Record<string, unknown>;

  if (typeof cardId !== 'string' || cardId.length === 0) {
    throw new ValidationError('cardId is required');
  }
  if (rating !== 'again' && rating !== 'known') {
    throw new ValidationError("rating must be 'again' or 'known'");
  }
  if (typeof idempotencyKey !== 'string' || !UUID_RE.test(idempotencyKey)) {
    throw new ValidationError('idempotencyKey must be a UUID');
  }

  return { cardId, rating, idempotencyKey };
}
