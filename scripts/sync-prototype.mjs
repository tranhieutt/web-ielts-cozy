/**
 * Copy the design-canvas prototype into the Next app's `public/` before a build.
 *
 * WHY THIS EXISTS: the Next app now serves the whole domain, and the nine
 * screens that have no real page yet are still served by the prototype. Those
 * files must live under `public/` to be served, but the SOURCE stays at the
 * repo root — that is what designers export over.
 *
 * Copying by hand would leave two divergent copies, and the failure is silent:
 * someone edits the root export, the deployed site does not change, and nothing
 * errors. So the copy is generated at build time and git-ignored, which makes
 * the root file the only source of truth by construction.
 */

import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { APP_ROUTES } from './app-routes.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'apps', 'web', 'public');

const COPIES = [
  { from: join(root, 'index.html'), to: join(publicDir, 'prototype.html') },
  { from: join(root, 'assets'), to: join(publicDir, 'assets') },
];

/**
 * The prototype is a single-page app: its nav calls `preventDefault()` and
 * swaps screens with `pushState`, so clicking "Từ vựng" rendered the mockup's
 * own vocabulary screen and the real page was never requested. Direct
 * navigation worked, which is what made this easy to miss.
 *
 * Two details decide whether this works at all:
 *
 * 1. It is injected into `<head>` BEFORE `dc-runtime.js`. Capture listeners on
 *    the same node fire in registration order, and the runtime registers as
 *    soon as its script runs — injecting at the end of `<body>` put this second,
 *    where it was already too late.
 * 2. It does NOT skip events with `defaultPrevented`. The prototype's handler
 *    always prevents default; that is the behaviour being overridden, so
 *    treating it as a reason to stand down defeats the entire purpose.
 *
 * Injected at build time rather than edited into the export, so a re-export
 * from design cannot quietly drop it.
 */
function handoffScript() {
  return `<script>(function(){
  var owned = ${JSON.stringify(APP_ROUTES)};
  document.addEventListener('click', function (event) {
    if (event.button !== 0) return;
    // Let the browser handle new-tab/new-window gestures itself.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var anchor = event.target && event.target.closest && event.target.closest('a[href]');
    if (!anchor) return;
    var url;
    try { url = new URL(anchor.getAttribute('href'), window.location.origin); } catch (e) { return; }
    if (url.origin !== window.location.origin) return;
    var mine = owned.some(function (base) {
      return url.pathname === base || url.pathname.indexOf(base + '/') === 0;
    });
    if (!mine) return;
    // stopImmediatePropagation, not stopPropagation: the runtime may also be
    // listening on this same node, and only the immediate form stops those.
    event.stopImmediatePropagation();
    event.preventDefault();
    window.location.assign(url.href);
  }, true);
})();</script>`;
}

async function main() {
  await mkdir(publicDir, { recursive: true });

  for (const { from, to } of COPIES) {
    try {
      await stat(from);
    } catch {
      // Fail loudly: a missing prototype means nine routes would 404 in
      // production, and a build that "succeeded" would hide it.
      throw new Error(`prototype source is missing: ${from}`);
    }

    // Remove first so a file deleted at the source cannot survive in the copy.
    await rm(to, { recursive: true, force: true });
    await cp(from, to, { recursive: true });
    console.log(`synced ${from.replace(root, '.')} -> ${to.replace(root, '.')}`);
  }

  const target = join(publicDir, 'prototype.html');
  const html = await readFile(target, 'utf8');
  if (!html.includes('<head>')) {
    throw new Error('prototype.html has no <head> to attach the route handoff to');
  }
  await writeFile(target, html.replace('<head>', `<head>
${handoffScript()}`));
  console.log(`injected route handoff for ${APP_ROUTES.join(', ')}`);
}

await main();
