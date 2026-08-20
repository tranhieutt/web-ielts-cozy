import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { validateCanonicalCatalog, validateContent } from '../../scripts/vocabulary/validate-content.mjs';

function makeContent(card) {
  const directory = mkdtempSync(join(tmpdir(), 'ielts-cozy-vocabulary-'));
  writeFileSync(join(directory, 'environment.jsonl'), `${JSON.stringify(card)}\n`, 'utf8');
  return directory;
}

function validCard(overrides = {}) {
  return {
    id: 'w_environment',
    word: 'air',
    topic: 'environment',
    senses: [{ def_vi: 'không khí' }],
    ...overrides,
  };
}

test('fails when source totals differ from fixed baseline', () => {
  assert.throws(
    () => validateContent({ contentDir: makeContent(validCard()) }),
    /Vocabulary source baseline mismatch: files=1 \(expected 23\), cards=1 \(expected 5275\), definitions=1 \(expected 7309\)/u,
  );
});

test('reports malformed JSONL, duplicate IDs, missing Vietnamese, and topic mismatch', () => {
  const malformed = mkdtempSync(join(tmpdir(), 'ielts-cozy-vocabulary-'));
  writeFileSync(join(malformed, 'environment.jsonl'), '{bad json}\n', 'utf8');
  assert.throws(() => validateContent({ contentDir: malformed, baseline: { files: 1, cards: 1, definitions: 1 } }), /environment\.jsonl:1 is not valid JSON/u);

  const duplicate = mkdtempSync(join(tmpdir(), 'ielts-cozy-vocabulary-'));
  writeFileSync(join(duplicate, 'environment.jsonl'), `${JSON.stringify(validCard())}\n${JSON.stringify(validCard())}\n`, 'utf8');
  assert.throws(() => validateContent({ contentDir: duplicate, baseline: { files: 1, cards: 2, definitions: 2 } }), /duplicate card ID/u);

  const missingVietnamese = makeContent(validCard({ senses: [{ def_vi: '  ' }] }));
  assert.throws(() => validateContent({ contentDir: missingVietnamese, baseline: { files: 1, cards: 1, definitions: 1 } }), /has no Vietnamese definition/u);

  const wrongTopic = makeContent(validCard({ topic: 'education' }));
  assert.throws(() => validateContent({ contentDir: wrongTopic, baseline: { files: 1, cards: 1, definitions: 1 } }), /primary topic education; expected environment/u);
});

test('fails when canonical learner payload leaks Chinese fields or Youdao URLs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ielts-cozy-catalog-'));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ cards: 1, definitions: 1 }), 'utf8');
  writeFileSync(join(directory, 'vocabulary-catalog.v1.jsonl'), `${JSON.stringify({
    id: 'w_bad',
    senses: [{ def_vi: 'hợp lệ', def_zh: '错误' }],
    examples: [{ en: 'Example', zh: '错误' }],
    audio: 'https://dict.youdao.com/dictvoice',
  })}\n`, 'utf8');
  assert.throws(() => validateCanonicalCatalog(directory), /forbidden field.*def_zh/u);
});

test('fails when canonical learner payload contains a Youdao URL', () => {
  const directory = mkdtempSync(join(tmpdir(), 'ielts-cozy-catalog-'));
  writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ cards: 1, definitions: 1 }), 'utf8');
  writeFileSync(join(directory, 'vocabulary-catalog.v1.jsonl'), `${JSON.stringify({
    id: 'w_bad_url',
    senses: [{ def_vi: 'hợp lệ' }],
    source_url: 'https://dict.youdao.com/dictvoice',
  })}\n`, 'utf8');
  assert.throws(() => validateCanonicalCatalog(directory), /forbidden Youdao value/u);
});
