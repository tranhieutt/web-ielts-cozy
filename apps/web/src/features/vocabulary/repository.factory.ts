/**
 * Picks the data adapter for one request.
 *
 * `VOCABULARY_DATA_SOURCE` defaults to `fixture` on purpose: an unconfigured
 * environment must run the harmless in-memory slice, never guess at production
 * credentials. Choosing `supabase` requires every credential up front and
 * fails loudly when one is missing.
 */

import { createFixtureRepository } from './repository.fixture.ts';
import { createSupabaseRepository } from './repository.supabase.ts';
import type { VocabularyRepository } from './repository';

export type DataSource = 'fixture' | 'supabase';

export function resolveDataSource(env: NodeJS.ProcessEnv = process.env): DataSource {
  const raw = env.VOCABULARY_DATA_SOURCE?.trim().toLowerCase();
  if (!raw || raw === 'fixture') return 'fixture';
  if (raw === 'supabase') return 'supabase';
  throw new Error(`VOCABULARY_DATA_SOURCE must be "fixture" or "supabase", got "${raw}"`);
}

export interface RepositoryContext {
  /** Required by the Supabase adapter; ignored by the fixture. */
  accessToken?: string;
  env?: NodeJS.ProcessEnv;
}

export function getRepository(context: RepositoryContext = {}): VocabularyRepository {
  const env = context.env ?? process.env;

  if (resolveDataSource(env) === 'fixture') return createFixtureRepository();

  const url = env.SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'VOCABULARY_DATA_SOURCE=supabase requires SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY',
    );
  }
  if (!context.accessToken) {
    throw new Error(
      'VOCABULARY_DATA_SOURCE=supabase requires a learner access token on every request (VOC-API-01)',
    );
  }

  return createSupabaseRepository({ url, publishableKey, accessToken: context.accessToken });
}
