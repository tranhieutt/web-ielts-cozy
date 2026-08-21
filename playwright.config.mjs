import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for `VOC-QA-04`.
 *
 * Runs against `VOCABULARY_DATA_SOURCE=fixture` on purpose:
 * - deterministic, so a failure means a regression rather than a data change;
 * - no credentials, so the suite runs in CI and on any contributor's machine;
 * - no writes to a real project, so running the tests never pollutes learner data.
 *
 * The fixture and the Supabase adapter implement the same seam and the same
 * compare-and-swap rules, so what passes here is a statement about the UI and
 * the service, not about the fixture. Database-only guarantees — transactions,
 * RLS, durability — are proven separately by `VOC-QA-02`.
 *
 * Mobile-first: 360px is the baseline width the spec targets.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'line' : [['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    launchOptions: {
      // The suite talks to 127.0.0.1 only. Any ambient proxy in the shell is
      // both unnecessary and harmful here: a filtering proxy answers 403 for
      // `/_next/static/chunks/*`, which strips the page of its JavaScript and
      // leaves every test staring at a loading state.
      args: ['--no-proxy-server'],
    },
  },

  projects: [
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } },
    },
  ],

  webServer: {
    // `npm run web:dev -- --port` does not forward cleanly through the
    // workspace script on Windows; call the workspace directly.
    command: 'npm run dev --workspace apps/web -- --port 3100',
    url: 'http://127.0.0.1:3100/vocabulary',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VOCABULARY_DATA_SOURCE: 'fixture',
      // Audio stays gated off (ADR-003) so the "unavailable" state is what the
      // suite sees, matching the current release posture.
      VOCABULARY_AUDIO_ENABLED: 'false',
    },
  },
});
