import { fileURLToPath } from 'node:url';

import { PROTOTYPE_ROUTES } from '../../scripts/app-routes.mjs';

/**
 * Routes still served by the design-canvas prototype (`public/prototype.html`).
 *
 * The prototype is not hand-written HTML: it is an export driven by a 69KB
 * runtime with its own template language (22 `sc-for`, 16 `sc-if`, 184 `{{ }}`
 * bindings). Re-implementing that in React would mean porting a reactive
 * template engine to reproduce screens that exist only to be replaced. Serving
 * it as-is keeps every screen working at a fraction of the risk, and each route
 * leaves the list the day a real Next page takes it over.
 *
 * The list lives in `scripts/app-routes.mjs` so the rewrite here, the prototype
 * sync, and the runtime check cannot drift apart. `/vocabulary` is deliberately
 * absent — it is a real page now, and filesystem routes win over rewrites.
 */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // fileURLToPath (not URL.pathname) so the root resolves on Windows too.
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),

  // Array form runs AFTER filesystem routes, so a real page always wins.
  async rewrites() {
    return PROTOTYPE_ROUTES.map((source) => ({
      source,
      destination: '/prototype.html',
    }));
  },
};

export default nextConfig;
