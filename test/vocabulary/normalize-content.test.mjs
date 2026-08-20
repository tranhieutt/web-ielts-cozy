import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeCard } from '../../scripts/vocabulary/normalize-content.mjs';

const baseCard = {
  id: 'w_example',
  word: 'air',
  is_phrase: false,
  topic: 'environment',
  topics_all: ['environment', 'science_research'],
  order: 1,
  cefr: 'A2',
  target_band: '4.5-5.0',
  phonetic: { uk: 'eə', us: 'ɛr' },
  audio: { uk: 'https://dict.youdao.com/example', us: 'https://dict.youdao.com/example' },
  senses: [{ pos: 'n', def_en: 'air', def_zh: '空气', def_vi: 'không khí' }],
  examples: [{ en: 'Fresh air.', zh: '新鲜空气。', vi: null }],
  collocations: [{ en: 'in the air', zh: '在空中', vi: null }],
};

test('normalizes learner-facing fields and removes Chinese/third-party audio', () => {
  const card = normalizeCard(baseCard, 'environment.jsonl');

  assert.deepEqual(card, {
    schema_version: 'vocabulary-card.v1',
    id: 'w_example',
    word: 'air',
    is_phrase: false,
    topic: 'environment',
    topics_all: ['environment', 'science_research'],
    order: 1,
    cefr: 'A2',
    target_band: '4.5-5.0',
    phonetic: { uk: 'eə', us: 'ɛr' },
    senses: [{ pos: 'n', def_vi: 'không khí', def_en: 'air' }],
    examples: [{ en: 'Fresh air.' }],
    collocations: [{ en: 'in the air' }],
  });
  assert.doesNotMatch(JSON.stringify(card), /zh|youdao/u);
});

test('rejects card whose primary topic does not match source file', () => {
  assert.throws(() => normalizeCard({ ...baseCard, topic: 'education' }, 'environment.jsonl'), /expected environment/u);
});
