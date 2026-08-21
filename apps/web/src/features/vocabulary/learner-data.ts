/**
 * Self-service deletion of a learner's study data (VOC-WEB-10, ADR-004).
 *
 * This does NOT live behind the repository seam. The seam exists so business
 * behavior can run on either data source; deletion is not business behavior and
 * has no meaning for the fixture, whose "storage" disappears when the process
 * does. Forcing it into the interface would add a method that one adapter can
 * only pretend to implement.
 */

import { resolveDataSource } from './repository.factory.ts';

export interface DeletionResult {
  deletedStates: number;
  deletedReviews: number;
}

export class LearnerDataDeletionError extends Error {}

export async function deleteLearnerData(
  { accessToken }: { accessToken?: string },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<DeletionResult> {
  if (resolveDataSource(env) === 'fixture') {
    // Nothing durable was ever written, so the learner's request is already
    // satisfied. Reporting zeros is honest; inventing counts would not be.
    return { deletedStates: 0, deletedReviews: 0 };
  }

  if (!accessToken) {
    throw new LearnerDataDeletionError('deleting learner data requires a learner session');
  }

  const url = env.SUPABASE_URL?.replace(/\/$/u, '');
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new LearnerDataDeletionError('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required');
  }

  const response = await fetchImpl(`${url}/rest/v1/rpc/delete_my_vocabulary_data`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      // The learner's own token: the function reads `auth.uid()` from it, so a
      // service-role call here would delete nothing (uid would be null) and,
      // worse, would invite someone to "fix" that by passing an id.
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: '{}',
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new LearnerDataDeletionError(
      `delete_my_vocabulary_data failed: ${response.status} ${detail.slice(0, 200)}`,
    );
  }

  const rows = (await response.json()) as Array<{
    deleted_states: number;
    deleted_reviews: number;
  }>;
  const row = rows[0];

  return {
    deletedStates: row?.deleted_states ?? 0,
    deletedReviews: row?.deleted_reviews ?? 0,
  };
}
