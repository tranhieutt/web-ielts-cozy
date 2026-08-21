/**
 * Data-source selection tests.
 *
 * The failure this guards against is a quiet one: an environment that is half
 * configured for Supabase and silently serves fixture data, or worse, reaches
 * the database without proving who the learner is. Both must be loud errors.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getRepository,
  resolveDataSource,
} from '../../apps/web/src/features/vocabulary/repository.factory.ts';

const SUPABASE_ENV = {
  VOCABULARY_DATA_SOURCE: 'supabase',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};

test('an unset data source means fixture, never a guess at production', () => {
  assert.equal(resolveDataSource({}), 'fixture');
  assert.equal(resolveDataSource({ VOCABULARY_DATA_SOURCE: '  Fixture ' }), 'fixture');
});

test('an unrecognised data source fails instead of falling back', () => {
  assert.throws(() => resolveDataSource({ VOCABULARY_DATA_SOURCE: 'postgres' }), /must be/);
});

test('supabase without credentials refuses rather than serving fixture data', () => {
  assert.throws(
    () => getRepository({ env: { VOCABULARY_DATA_SOURCE: 'supabase' }, accessToken: 'token' }),
    /SUPABASE_URL/,
  );
});

test('supabase without a learner token refuses: VOC-API-01 is a hard dependency', () => {
  assert.throws(() => getRepository({ env: SUPABASE_ENV }), /access token/);
});

test('a fully configured supabase environment yields the adapter', () => {
  const repo = getRepository({ env: SUPABASE_ENV, accessToken: 'learner-token' });
  assert.equal(typeof repo.commitReview, 'function');
});

test('both adapters satisfy the same seam, so the service cannot tell them apart', () => {
  const fixture = getRepository({ env: {} });
  const supabase = getRepository({ env: SUPABASE_ENV, accessToken: 'learner-token' });

  assert.deepEqual(Object.keys(fixture).sort(), Object.keys(supabase).sort());
});
