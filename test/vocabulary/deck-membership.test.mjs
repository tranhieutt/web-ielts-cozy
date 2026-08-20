import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { buildDeckMembership } from '../../scripts/vocabulary/build-deck-membership.mjs';
import { readContentVersion } from '../../scripts/vocabulary/import-decks-to-supabase.mjs';
import { normalizeCorpus } from '../../scripts/vocabulary/normalize-content.mjs';

test('maps shared cards to decks without duplicating card identity or content version', () => {
  const { decks, rows } = buildDeckMembership(normalizeCorpus().cards, { contentVersion: 'catalog-sha' });

  assert.equal(decks.length, 23);
  assert.equal(rows.length, 8271);
  assert.ok(decks.every((deck) => deck.content_version === 'catalog-sha' && deck.publish_status === 'draft'));
  assert.equal(new Set(rows.map(({ deck_slug, card_id }) => `${deck_slug}:${card_id}`)).size, rows.length);
  assert.ok(rows.every((row) => Number.isInteger(row.position) && row.position >= 0));
  assert.ok(rows.some((row) => row.is_primary));
  assert.ok(rows.some((row) => !row.is_primary));
});

test('rejects missing deck metadata and content version', () => {
  assert.throws(() => buildDeckMembership([], {}), /contentVersion/);
  assert.throws(
    () => buildDeckMembership([{ id: 'w_test', topic: 'environment', topics_all: ['unknown_topic'], order: 0 }], { contentVersion: 'v1' }),
    /Missing Vietnamese deck metadata: unknown_topic/,
  );
});

test('reads content version from catalog manifest', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ielts-cozy-decks-'));
  const catalog = join(directory, 'catalog.jsonl');
  writeFileSync(catalog, '{}\n', 'utf8');
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ catalog_sha256: 'catalog-sha' }), 'utf8');
  assert.equal(readContentVersion(catalog), 'catalog-sha');
});
