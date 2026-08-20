import { access, readFile } from 'node:fs/promises';
import nextConfig from '../apps/web/next.config.mjs';
import { APP_ROUTES } from './app-routes.mjs';
import { findRouteProblems } from './route-coverage.mjs';

const files = [
  'index.html',
  'vercel.json',
  'assets/dc-runtime.js',
  'assets/images/hero-768.webp',
  'assets/images/hero-1280.webp',
  'assets/images/reading-480.webp',
  'assets/images/reading-768.webp',
  'assets/images/writing-480.webp',
  'assets/images/writing-768.webp',
  'assets/images/listening-480.webp',
  'assets/images/listening-768.webp',
  'assets/images/speaking-480.webp',
  'assets/images/speaking-768.webp'
];
for (const file of files) await access(new URL(`../${file}`, import.meta.url));

const [html, vercelConfig, dcRuntime] = await Promise.all(['index.html', 'vercel.json', 'assets/dc-runtime.js'].map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
for (const fragment of ['<x-dc>', 'data-dc-script', 'assets/dc-runtime.js', 'hero-1280.webp', 'loading="lazy"', 'srcset="{{ s.srcSet }}"']) {
  if (!html.includes(fragment)) throw new Error(`index.html missing ${fragment}`);
}
for (const screen of ['dashboard', 'reading', 'listening', 'writing', 'speaking', 'mock', 'vocab', 'library', 'progress', 'profile']) {
  if (!html.includes(`'${screen}'`)) throw new Error(`index.html missing ${screen} mockup screen`);
}
for (const fragment of ['@media (max-width:767px)', 'primary-nav', 'page-content', 'home-skill-grid', 'position:static!important']) {
  if (!html.includes(fragment)) throw new Error(`index.html missing mobile responsive contract: ${fragment}`);
}
for (const route of ['/dashboard', '/reading', '/listening', '/writing', '/speaking', '/mock', '/vocabulary', '/library', '/progress', '/profile']) {
  if (!html.includes(`'${route}'`)) throw new Error(`index.html missing route: ${route}`);
}
// The Next app now serves the whole domain, so the deploy contract is no
// longer an SPA rewrite. It is this: EVERY route the prototype can navigate to
// must be served by something — either a rewrite to the prototype, or a real
// Next page that has taken that screen over. Without this check, adding a
// screen to the prototype and forgetting to route it produces a 404 in
// production and nothing fails at build time.
const vercel = JSON.parse(vercelConfig);
if (vercel.outputDirectory !== 'apps/web/.next') throw new Error('vercel.json must build the Next app');

const rewritten = new Set((await nextConfig.rewrites()).map(rewrite => rewrite.source));
const prototypeRoutes = [...html.matchAll(/'(\/[a-z][a-z0-9/-]*)'/g)].map(match => match[1]);

async function pageExists(route) {
  try {
    await access(new URL(`../apps/web/src/app${route}/page.tsx`, import.meta.url));
    return true;
  } catch {
    return false;
  }
}

// Resolve every candidate up front so the rules themselves stay synchronous
// and testable.
const candidates = [...new Set(['/', ...prototypeRoutes, ...APP_ROUTES])];
const existing = new Set();
for (const route of candidates) if (await pageExists(route)) existing.add(route);

const problems = findRouteProblems({
  reachable: ['/', ...prototypeRoutes],
  rewritten,
  appRoutes: APP_ROUTES,
  pageExists: route => existing.has(route),
});
if (problems.length > 0) throw new Error(problems.join('; '));

// The handoff only exists in the SYNCED copy, so a build that forgot to run the
// sync would rewrite routes correctly and still leave every click trapped in
// the prototype's own router.
const synced = await readFile(new URL('../apps/web/public/prototype.html', import.meta.url), 'utf8')
  .catch(() => null);
if (synced !== null) {
  for (const route of APP_ROUTES) {
    if (!synced.includes(`"${route}"`)) {
      throw new Error(`synced prototype does not hand ${route} over to the app`);
    }
  }
}

if (html.includes('uploads/') || html.includes('Pantone') || html.includes('.png')) throw new Error('index.html must use optimized runtime assets and canonical design names');
if (!dcRuntime.includes('loadReactUmd')) throw new Error('DC runtime is incomplete');
console.log(`Prototype runtime verified; ${rewritten.size} routes rewritten, real pages cover the rest.`);
