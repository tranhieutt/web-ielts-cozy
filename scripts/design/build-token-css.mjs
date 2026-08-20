/**
 * Generate CSS custom properties from `design-tokens.json`.
 *
 * DESIGN.md §2: generated CSS must DERIVE from the token file and never become
 * a second source of truth. Feature CSS therefore only ever references
 * `var(--token-name)`; no literal colour, spacing, or type value is allowed to
 * appear in feature code.
 *
 * Run: npm run design:build-tokens
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = resolve('design-tokens.json');
const TARGET = resolve('apps/web/src/app/tokens.css');

const tokens = JSON.parse(readFileSync(SOURCE, 'utf8'));

/** DTCG alias syntax: `{color.core.ink}` points at another token's $value. */
function resolveAlias(value, seen = new Set()) {
  if (typeof value !== 'string') return value;
  const match = /^\{([^}]+)\}$/.exec(value.trim());
  if (!match) return value;

  const path = match[1];
  if (seen.has(path)) throw new Error(`circular token alias: ${path}`);
  seen.add(path);

  const target = path.split('.').reduce((node, key) => node?.[key], tokens);
  if (!target || !('$value' in target)) throw new Error(`unknown token alias: {${path}}`);
  return resolveAlias(target.$value, seen);
}

/** DTCG composite types need a CSS-shaped serialisation, not JSON. */
function cssValue(value, type) {
  const resolved = resolveAlias(value);

  if (type === 'shadow') {
    const { inset, offsetX, offsetY, blur, spread, color } = resolved;
    const parts = [offsetX, offsetY, blur, spread, color].map((part) => resolveAlias(part));
    return `${inset ? 'inset ' : ''}${parts.join(' ')}`;
  }
  if (type === 'cubicBezier') {
    return `cubic-bezier(${resolved.join(', ')})`;
  }
  if (Array.isArray(resolved)) return resolved.join(', ');
  if (resolved !== null && typeof resolved === 'object') {
    throw new Error(`unsupported composite token type: ${type}`);
  }
  return resolved;
}

const cssName = (path) =>
  `--${path.map((part) => part.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()).join('-')}`;

const declarations = [];
(function walk(node, path = []) {
  for (const [key, value] of Object.entries(node)) {
    if (!value || typeof value !== 'object') continue;
    if ('$value' in value) {
      declarations.push(`  ${cssName([...path, key])}: ${cssValue(value.$value, value.$type)};`);
    } else {
      walk(value, [...path, key]);
    }
  }
})(tokens);

const css = `/*
 * GENERATED FILE — do not edit.
 * Source: design-tokens.json · Generator: scripts/design/build-token-css.mjs
 * Regenerate with: npm run design:build-tokens
 */

:root {
${declarations.join('\n')}
}
`;

writeFileSync(TARGET, css, 'utf8');
console.log(`Wrote ${declarations.length} design tokens to ${TARGET}`);
