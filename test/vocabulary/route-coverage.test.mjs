/**
 * The deploy contract: every reachable route must be served by something.
 *
 * This exists because the check it guards was silently weakened. An earlier
 * version skipped app-owned routes outright, so deleting `vocabulary/page.tsx`
 * left the build green while the prototype's handoff sent every click to a 404.
 * A gate that cannot fail is not a gate.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { findRouteProblems } from '../../scripts/route-coverage.mjs';

const REWRITTEN = new Set(['/', '/dashboard', '/reading']);
const APP_ROUTES = ['/vocabulary'];

/** Everything present: the shape the repo is supposed to be in. */
const healthy = {
  reachable: ['/', '/dashboard', '/reading', '/vocabulary'],
  rewritten: REWRITTEN,
  appRoutes: APP_ROUTES,
  pageExists: (route) => route === '/vocabulary',
};

test('a fully served set of routes reports no problems', () => {
  assert.deepEqual(findRouteProblems(healthy), []);
});

test('an app-claimed route whose page is gone is reported', () => {
  const problems = findRouteProblems({ ...healthy, pageExists: () => false });

  assert.ok(
    problems.some((p) => p.includes('/vocabulary') && p.includes('no page')),
    `expected a missing-page problem for /vocabulary, got ${JSON.stringify(problems)}`,
  );
});

test('the claim is checked even when the prototype never links to the route', () => {
  // The prototype could drop the link while `APP_ROUTES` still claims it. The
  // handoff would then be inert, but the claim is still a lie worth catching.
  const problems = findRouteProblems({
    ...healthy,
    reachable: ['/', '/dashboard'],
    pageExists: () => false,
  });

  assert.ok(problems.some((p) => p.includes('/vocabulary')));
});

test('a sub-path of a healthy app route does not double-report', () => {
  const problems = findRouteProblems({
    ...healthy,
    reachable: [...healthy.reachable, '/vocabulary/review'],
  });

  assert.deepEqual(problems, []);
});

test('a reachable route with neither a rewrite nor a page is reported', () => {
  const problems = findRouteProblems({ ...healthy, reachable: [...healthy.reachable, '/speaking'] });

  assert.deepEqual(problems, ['route /speaking is reachable in the prototype but nothing serves it']);
});
