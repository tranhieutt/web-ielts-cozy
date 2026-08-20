import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SRS_RATINGS,
  STAGE_INTERVAL_MINUTES,
  transitionVocabularySrs,
} from '../../src/features/vocabulary/srs/transition.mjs';

const REVIEWED_AT = '2026-08-20T23:55:00.000Z';

const cases = [
  ['new', null, SRS_RATINGS.AGAIN, 'learning', 0],
  ['new', null, SRS_RATINGS.KNOWN, 'review', 1],
  ['learning', 0, SRS_RATINGS.AGAIN, 'learning', 0],
  ['learning', 0, SRS_RATINGS.KNOWN, 'review', 1],
  ['review', 1, SRS_RATINGS.AGAIN, 'learning', 0],
  ['review', 1, SRS_RATINGS.KNOWN, 'review', 2],
  ['review', 2, SRS_RATINGS.AGAIN, 'review', 1],
  ['review', 2, SRS_RATINGS.KNOWN, 'review', 3],
  ['review', 3, SRS_RATINGS.AGAIN, 'review', 2],
  ['review', 3, SRS_RATINGS.KNOWN, 'review', 4],
  ['review', 4, SRS_RATINGS.AGAIN, 'review', 3],
  ['review', 4, SRS_RATINGS.KNOWN, 'review', 5],
  ['review', 5, SRS_RATINGS.AGAIN, 'review', 4],
  ['review', 5, SRS_RATINGS.KNOWN, 'mastered', 6],
  ['mastered', 6, SRS_RATINGS.AGAIN, 'review', 5],
  ['mastered', 6, SRS_RATINGS.KNOWN, 'mastered', 6],
];

test('implements all 16 Vocabulary SRS transition cells with UTC due time', () => {
  for (const [state, stage, rating, expectedState, expectedStage] of cases) {
    const input = { state, stage };
    const result = transitionVocabularySrs(input, rating, REVIEWED_AT);
    const expectedDueAt = new Date(
      new Date(REVIEWED_AT).getTime() + STAGE_INTERVAL_MINUTES[expectedStage] * 60_000,
    ).toISOString();

    assert.deepEqual(result, {
      state: expectedState,
      stage: expectedStage,
      dueAt: expectedDueAt,
      intervalMinutes: STAGE_INTERVAL_MINUTES[expectedStage],
    }, `${state}:${stage ?? '—'} + ${rating}`);
    assert.deepEqual(input, { state, stage }, 'transition must not mutate persisted state');
  }
});

test('uses exact stage intervals across a UTC day boundary', () => {
  assert.deepEqual(STAGE_INTERVAL_MINUTES, {
    0: 10,
    1: 1_440,
    2: 4_320,
    3: 10_080,
    4: 20_160,
    5: 43_200,
    6: 86_400,
  });

  const result = transitionVocabularySrs(
    { state: 'new', stage: null },
    SRS_RATINGS.AGAIN,
    REVIEWED_AT,
  );

  assert.equal(result.dueAt, '2026-08-21T00:05:00.000Z');
});

test('rejects invalid persisted states, ratings, and review timestamps', () => {
  assert.throws(
    () => transitionVocabularySrs({ state: 'review', stage: 0 }, SRS_RATINGS.AGAIN, REVIEWED_AT),
    /Invalid Vocabulary SRS state\/stage/,
  );
  assert.throws(
    () => transitionVocabularySrs({ state: 'new', stage: 0 }, SRS_RATINGS.AGAIN, REVIEWED_AT),
    /Invalid Vocabulary SRS state\/stage/,
  );
  assert.throws(
    () => transitionVocabularySrs({ state: 'new', stage: null }, 'hard', REVIEWED_AT),
    /Unsupported Vocabulary SRS rating/,
  );
  assert.throws(
    () => transitionVocabularySrs({ state: 'new', stage: null }, SRS_RATINGS.AGAIN, 'not-a-date'),
    /reviewedAt must be a valid UTC timestamp/,
  );
});
