/**
 * Build the vertical-slice fixture (plan §5, VOC-DATA-07a stand-in).
 *
 * The slice needs real learner-facing content without a Supabase connection,
 * so this takes the first N Environment cards through the SAME normalizer the
 * canonical catalog uses. That keeps the fixture on the published contract:
 * no `zh` fields, no Youdao audio URLs.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { normalizeCard } from './normalize-content.mjs';

const SOURCE = resolve('content/vocabulary/ielts_vocab_by_topic/environment.jsonl');
const TARGET = resolve('apps/web/src/features/vocabulary/fixtures/environment-slice.json');
const CARD_LIMIT = 20;

const cards = readFileSync(SOURCE, 'utf8')
  .split('\n')
  .filter((line) => line.trim().length > 0)
  .map((line) => normalizeCard(JSON.parse(line), 'environment.jsonl'))
  .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  .slice(0, CARD_LIMIT);

const fixture = {
  schema_version: 'vocabulary-slice-fixture.v1',
  generated_by: 'scripts/vocabulary/build-slice-fixture.mjs',
  deck: {
    slug: 'environment',
    display_name_vi: 'Môi trường',
    publish_status: 'published',
  },
  cards,
};

writeFileSync(TARGET, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');
console.log(`Wrote ${cards.length} cards to ${TARGET}`);
