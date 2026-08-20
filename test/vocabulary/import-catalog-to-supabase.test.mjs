import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { cardRow, readCatalog } from '../../scripts/vocabulary/import-catalog-to-supabase.mjs';

function catalog(lines) {
  const file = join(mkdtempSync(join(tmpdir(), 'ielts-cozy-import-')), 'catalog.jsonl');
  writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  return file;
}

const valid = { id: 'w_air', word: 'air', topic: 'environment', topics_all: ['environment'], order: 0, senses: [{ def_vi: 'không khí' }] };

test('reads canonical JSONL and maps an idempotent card row', () => {
  const [card] = readCatalog(catalog([JSON.stringify(valid)]));
  assert.deepEqual(cardRow(card, 'v1'), {
    id: 'w_air', word: 'air', is_phrase: false, primary_topic: 'environment', topics_all: ['environment'],
    sort_order: 0, cefr: null, target_band: null, phonetic: null, senses: [{ def_vi: 'không khí' }],
    examples: null, collocations: null, content_status: 'draft', source_version: 'v1',
  });
});

test('rejects malformed lines, duplicate IDs, and non-JSONL inputs with line detail', () => {
  assert.throws(() => readCatalog(catalog(['{broken'])), /catalog\.jsonl:1 is not valid JSON/);
  assert.throws(() => readCatalog(catalog([JSON.stringify(valid), JSON.stringify(valid)])), /catalog\.jsonl:2 duplicate card ID/);
  assert.throws(() => readCatalog(join(tmpdir(), 'catalog.json')), /only a \.jsonl catalog/);
});
