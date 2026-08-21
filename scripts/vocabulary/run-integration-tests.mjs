/**
 * Runs the Vocabulary integration tests against a real Supabase project.
 *
 * WHY A RUNNER AND NOT `VOCABULARY_INTEGRATION=1 node --test ...`: that syntax
 * is bash-only. On PowerShell — the default shell on Windows, which this repo
 * is developed on — it fails with "not recognized as the name of a cmdlet".
 * Setting the flag here means one command works in every shell.
 *
 * The opt-in itself still matters: plain `npm test` leaves these skipped, so
 * the ordinary suite stays offline and nobody writes to a real project by
 * running the tests.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Existing environment wins, so CI secrets are never overridden by a local file. */
function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const match = raw.trim().match(/^([A-Z][A-Z0-9_]*)=(.*)$/u);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/gu, '');
    }
  }
}

loadEnv(join(ROOT, '.env.local'));

const missing = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
  (name) => !process.env[name],
);

if (missing.length > 0) {
  // Named explicitly: "tests skipped" with no reason is how a broken
  // integration suite quietly passes forever.
  console.error(`Cannot run integration tests. Missing: ${missing.join(', ')}`);
  console.error('Set them in .env.local or the environment, then re-run.');
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  ['--test', 'test/vocabulary/review-write.integration.test.mjs'],
  {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, VOCABULARY_INTEGRATION: '1' },
  },
);

process.exit(result.status ?? 1);
