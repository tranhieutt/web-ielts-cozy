import { access, readFile } from 'node:fs/promises';
import nextConfig from '../apps/web/next.config.mjs';

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

for (const route of new Set(['/', ...prototypeRoutes])) {
  if (rewritten.has(route)) continue;
  // Taken over by a real page, e.g. /vocabulary.
  try {
    await access(new URL(`../apps/web/src/app${route}/page.tsx`, import.meta.url));
  } catch {
    throw new Error(`route ${route} is reachable in the prototype but nothing serves it`);
  }
}
if (html.includes('uploads/') || html.includes('Pantone') || html.includes('.png')) throw new Error('index.html must use optimized runtime assets and canonical design names');
if (!dcRuntime.includes('loadReactUmd')) throw new Error('DC runtime is incomplete');
console.log(`Prototype runtime verified; ${rewritten.size} routes rewritten, real pages cover the rest.`);
