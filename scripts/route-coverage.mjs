/**
 * The deploy contract, as a pure function so it can be tested.
 *
 * Every route a learner can reach must be served by SOMETHING: a rewrite to the
 * prototype, or a real Next page that has taken that screen over. Nothing else
 * fails at build time when a screen loses its route — the 404 only shows up in
 * production.
 *
 * `pageExists` is injected rather than read from disk here, so the rules can be
 * exercised against cases that must never occur in the repo itself — such as an
 * `APP_ROUTES` entry whose page has been deleted.
 */

/**
 * @param {object} input
 * @param {string[]} input.reachable Routes the prototype can navigate to.
 * @param {Set<string>} input.rewritten Route sources rewritten to the prototype.
 * @param {string[]} input.appRoutes Routes claimed by the Next application.
 * @param {(route: string) => boolean} input.pageExists Does a real page back this route?
 * @returns {string[]} Human-readable problems; empty means the contract holds.
 */
export function findRouteProblems({ reachable, rewritten, appRoutes, pageExists }) {
  const problems = [];
  const ownedBy = (route) =>
    appRoutes.find((base) => route === base || route.startsWith(`${base}/`));

  // Every route the app CLAIMS must have a page, whether or not the prototype
  // links to it. Claiming a route makes the prototype hand clicks over to it,
  // so a claim without a page sends learners straight to a 404 — which is
  // exactly what an unconditional skip here used to hide.
  for (const route of appRoutes) {
    if (!pageExists(route)) {
      problems.push(`route ${route} is claimed by the app but has no page`);
    }
  }

  for (const route of new Set(reachable)) {
    if (rewritten.has(route)) continue;

    const owner = ownedBy(route);
    if (owner) {
      // Reported once above; do not repeat it per reachable sub-path.
      if (!pageExists(owner)) continue;
      continue;
    }

    if (!pageExists(route)) {
      problems.push(`route ${route} is reachable in the prototype but nothing serves it`);
    }
  }

  return problems;
}
