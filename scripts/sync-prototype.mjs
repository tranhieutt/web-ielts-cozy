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

import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'apps', 'web', 'public');

const COPIES = [
  { from: join(root, 'index.html'), to: join(publicDir, 'prototype.html') },
  { from: join(root, 'assets'), to: join(publicDir, 'assets') },
];

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
}

await main();
