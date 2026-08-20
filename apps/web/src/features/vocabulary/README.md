# Vocabulary feature

Implements the Vocabulary MVP behavior specified in
[`docs/product/VOCABULARY_SPEC.md`](../../../../../docs/product/VOCABULARY_SPEC.md).

## Layout

| File | Role |
|---|---|
| `srs/transition.mjs` | Two-rating SRS schedule, spec §8.1/§8.2 (`VOC-API-04`). Pure. |
| `srs/session-queue.mjs` | In-session ordering, spec §8.3 (`VOC-API-04b`). Pure. |
| `service.ts` | Deck catalog, queue building, review submission (`VOC-API-02/03/05`). |
| `schema.ts` | Boundary validation for the API routes. |
| `repository.fixture.ts` | Fixture data adapter for the vertical slice. |
| `identity.ts` | Placeholder learner identity (`VOC-API-01` replaces it). |
| `fixtures/environment-slice.json` | 20 Environment cards, generated — do not hand-edit. |

Regenerate the fixture with `npm run vocab:build-slice-fixture`. It runs the
same normalizer as the canonical catalog, so the fixture cannot drift onto a
different content contract.

## Invariants

- `due_at` is read only when building a NEW session queue. In-session ordering
  never reads it (spec §8.3).
- Publishable = card published AND deck published (spec §4).
- No `zh` field and no Youdao audio URL may reach a learner-facing payload
  (VOC-08); `service.test.mjs` asserts this on the real fixture payload.
- A repeated `idempotencyKey` replays the first result and never advances a
  second stage (spec §8.4).

## What this is NOT yet

`repository.fixture.ts` keeps learner state in process memory. Progress is lost
on restart, so the slice does **not** satisfy VOC-07 (durable progress) and
must not be pointed at real learners. The Supabase adapter (`VOC-DATA-07a` +
`VOC-API-01`) implements the same exported functions and replaces it.
