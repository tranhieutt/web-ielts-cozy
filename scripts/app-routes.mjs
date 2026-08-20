/**
 * Which routes belong to the Next application, and which are still the
 * design-canvas prototype.
 *
 * One source of truth, imported by `next.config.mjs` (to rewrite prototype
 * routes), `sync-prototype.mjs` (to stop the prototype's client-side router
 * hijacking real pages), and `verify-static-runtime.mjs` (to assert every
 * reachable route is served by something). Three files disagreeing about this
 * list is how a screen silently 404s or silently keeps serving a mockup.
 */

/** Owned by real Next pages. Sub-paths count: `/vocabulary/review` is ours too. */
export const APP_ROUTES = ['/vocabulary'];

/** Still served by `public/prototype.html` until a real page takes them over. */
export const PROTOTYPE_ROUTES = [
  '/',
  '/dashboard',
  '/library',
  '/listening',
  '/mock',
  '/profile',
  '/progress',
  '/reading',
  '/speaking',
  '/writing',
];
