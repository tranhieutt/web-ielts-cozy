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
| `repository.ts` | The data seam: the interface `service.ts` talks to. |
| `repository.fixture.ts` | In-memory adapter for the vertical slice. |
| `repository.supabase.ts` | Supabase adapter over PostgREST (`VOC-API-02s/03s/05s`). |
| `repository.factory.ts` | Picks the adapter from `VOCABULARY_DATA_SOURCE`. |
| `identity.ts` | Learner identity: anonymous session in `supabase` mode, unsigned cookie in `fixture` mode. |
| `auth/anonymous.ts` | Supabase Anonymous Auth over GoTrue REST (`VOC-API-01`). |
| `fixtures/environment-slice.json` | 20 Environment cards, generated — do not hand-edit. |

Regenerate the fixture with `npm run vocab:build-slice-fixture`. It runs the
same normalizer as the canonical catalog, so the fixture cannot drift onto a
different content contract.

## The review RPC is owned by the database, not by this code

`submit_vocabulary_review` is deployed and went through six iterations before
this adapter existed. Its parameter names (`p_expected_*`) and result column
names (`result_*`) are fixed by the function; `repository.supabase.ts` matches
them rather than choosing its own.

Two properties in there were learned the hard way and must not be "simplified":

- The state upsert is guarded by `where s.state = p_expected_state`. Without it
  two concurrent sessions lose an update.
- A lost race raises `PT409`, deliberately **not** `40001`. PostgREST treats
  `serialization_failure` as transient and retries it automatically, which turns
  one lost race into an unbounded retry loop.

Before changing it, read `supabase/migrations/20260820*` in order.

## Invariants

- `due_at` is read only when building a NEW session queue. In-session ordering
  never reads it (spec §8.3).
- Publishable = card published AND deck published (spec §4).
- No `zh` field and no Youdao audio URL may reach a learner-facing payload
  (VOC-08); `service.test.mjs` asserts this on the real fixture payload.
- A repeated `idempotencyKey` replays the first result and never advances a
  second stage (spec §8.4). The adapter's uniqueness constraint decides this,
  not a read-then-write check in `service.ts`, so a double-tap cannot race.
- The Supabase adapter never uses the service-role key and never filters
  learner rows by a client-supplied id. Identity comes from the learner's
  access token so RLS stays the thing that enforces isolation.
- `VOCABULARY_DATA_SOURCE` defaults to `fixture`. A half-configured Supabase
  environment raises instead of quietly serving fixture data.

## Switching data sources

| `VOCABULARY_DATA_SOURCE` | Requires | Durable |
|---|---|---|
| `fixture` (default) | nothing | no |
| `supabase` | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `enable_anonymous_sign_ins`, seeded content | yes |

In `supabase` mode `identity.ts` mints the token itself, so nothing upstream has
to supply one. Access and refresh tokens are httpOnly cookies; the refresh
cookie lives 90 days to match the ADR-004 retention window.

## What this is NOT yet

`repository.fixture.ts` keeps learner state in process memory. Progress is lost
on restart, so the default configuration does **not** satisfy VOC-07 (durable
progress) and must not be pointed at real learners.

`repository.supabase.ts` and the anonymous session are both written, but the
pair has **never run against a real project**. Two things are still missing and
neither is code: `enable_anonymous_sign_ins` must be on in the target
environment (`VOC-INFRA-06` — the repo config is set, the remote dashboard is
not), and content must be seeded and published (`VOC-DATA-07a`). Until both
land, `VOCABULARY_DATA_SOURCE=supabase` will fail at the first request.

The adapter's tests use a stub `fetch`, so they prove the request shape and the
row mapping. They do **not** prove that `submit_vocabulary_review` is genuinely
transactional or that RLS isolates learners — that needs a seeded database and
is `VOC-QA-02`.
