# IELTS Cozy Code Map

## Status — 2026-08-20

Vocabulary is an implemented Next.js vertical slice: published Supabase content, anonymous/authenticated learner identity, transactional review writes, and durable progress. These paths were verified against project `iixvtoaifxuqjjdbwrzh`.

Next owns `/vocabulary` and `/vocabulary/review`. Remaining screens use Design Code prototype through Next rewrites. Local production build passes. Vercel preview deployment still needs its documented Preview Comments setting; see `docs/product/VOCABULARY_EXECUTION_PLAN.md`.

## Fast orientation

```text
Vocabulary requirements  docs/product/VOCABULARY_SPEC.md
Execution status         docs/product/VOCABULARY_EXECUTION_PLAN.md
Product rules            docs/product/PRODUCT_SPEC.md
Architecture             docs/architecture/ARCHITECTURE.md
Design rules             DESIGN.md
Design values            design-tokens.json
Agent protocol           AGENTS.md
Prototype source         index.html
Runtime entry            apps/web/
```

## Runtime and route ownership

```text
index.html + assets/
  -> scripts/sync-prototype.mjs
  -> apps/web/public/prototype.html + public/assets/   (generated, gitignored)
  -> Next rewrites for prototype-only routes

apps/web/src/app/vocabulary/**
  -> real Next pages for /vocabulary and /vocabulary/review
```

| Path | Status | Purpose |
|---|---|---|
| `index.html` | Active source | Design Code prototype. Single source for fallback screens and their interactions. |
| `assets/` | Active source | Prototype runtime and approved visual assets. |
| `scripts/app-routes.mjs` | Active | Route ownership: real app `/vocabulary`; ten prototype fallback routes. |
| `scripts/sync-prototype.mjs` | Active | Copies prototype source at build time; injects capture-phase handoff for app links. |
| `apps/web/next.config.mjs` | Active | Rewrites prototype-only paths to `/prototype.html`; filesystem routes win. |
| `apps/web/` | Active | Next.js App Router application, Vocabulary BFF routes, real UI. |
| `scripts/verify-static-runtime.mjs` | Active | Verifies reachable prototype routes and app-owned route pages. |
| `scripts/route-coverage.mjs` | Active | Pure route coverage logic used by tests/runtime check. |
| `vercel.json` | Active | Builds Next application; no longer serves catch-all static SPA. |

`APP_ROUTES` treats `/vocabulary/review` as owned by `/vocabulary`. When a prototype screen becomes real, remove it from `PROTOTYPE_ROUTES`, add page, retain coverage check.

## Implemented Vocabulary module

```text
apps/web/src/features/vocabulary/
├── components/                 Catalog, flashcard, audio, session, summary UI
├── srs/transition.mjs          Pure two-rating SRS transition (spec §8.1/§8.2)
├── srs/session-queue.mjs       Pure in-session reinsert ordering (spec §8.3)
├── schema.ts                   Queue/review request validation
├── service.ts                  Catalog, queue, progress, review orchestration
├── content.ts                  Content adapter selector
├── repository.supabase.ts      Published catalog read adapter
├── repository.fixture.ts       Local/test fixture adapter only
├── learner.ts                  Per-request learner state selector
├── learner.supabase.ts         Token-scoped state reads and review RPC client
├── auth.supabase.ts            GoTrue REST, refresh, PKCE helpers
├── identity.ts                 Session-cookie and Google-link lifecycle
├── route-helpers.ts            Resolve/attach learner session and auth errors
├── audio.ts                    Release-gated Google TTS source resolver
└── types.ts                    Feature-local contracts
```

Fixture state is permitted only without access token for local/offline development and hermetic tests. Real learner sessions always use `learner.supabase.ts`; no environment flag can route durable traffic back to fixture state.

## Next pages and API routes

| Route | Handler | Responsibility |
|---|---|---|
| `/vocabulary` | `app/vocabulary/page.tsx` + `DeckCatalog` | Published deck catalog, learner progress, account-link disclosure. |
| `/vocabulary/review` | `app/vocabulary/review/page.tsx` + `ReviewSession` | Queue, flashcard, ratings, offline/error state, summary. |
| `GET /api/vocabulary/decks` | `api/vocabulary/decks/route.ts` | Deck summaries with learner progress. |
| `GET /api/vocabulary/queue` | `api/vocabulary/queue/route.ts` | Validated due/new queue; limit 1–50. |
| `POST /api/vocabulary/reviews` | `api/vocabulary/reviews/route.ts` | Validated idempotent review submission. |
| `GET /api/vocabulary/progress` | `api/vocabulary/progress/route.ts` | Learner-wide and per-deck progress. |
| `GET /api/vocabulary/auth/google` | `api/vocabulary/auth/google/route.ts` | Starts PKCE Google identity link. |
| `GET /api/vocabulary/auth/callback` | `api/vocabulary/auth/callback/route.ts` | Exchanges code server-side; attaches linked session. |

Learner routes use `withLearner`: reuse token, refresh, or create anonymous identity; write rotated session back. Google uses `linkIdentity`, not normal sign-in, so anonymous UUID and progress survive account upgrade.

## Data flow and persistence

```text
Browser
  -> Next page / API route
  -> route validation + withLearner
  -> vocabulary service + pure SRS transition
  -> content or learner adapter
  -> Supabase Auth / PostgREST / Postgres RPC
```

- `learner_id` is Supabase Auth UUID. Anonymous sessions use 30-day httpOnly cookies; Google adds identity to same user.
- `submit_vocabulary_review` atomically persists review event and derived card state. Unique `(learner_id, idempotency_key)` replays retry result.
- Compare-and-swap prevents stale state transition; losing request receives 409, service re-reads once.
- RLS, not user-provided learner ID, determines access. Web runtime has publishable key only.

## Supabase and content operations

| Path | Status | Purpose |
|---|---|---|
| `20260820041818_create_vocabulary_catalog_and_learner_state.sql` | Applied | Catalog/state schema, grants, RLS, learner FK/cascade. |
| `20260820093000_create_vocabulary_deck_summary.sql` | Applied | `security_invoker` deck summary view. |
| `20260820140000_create_submit_vocabulary_review.sql` | Applied | Initial transactional review RPC. |
| `20260820150000_serialize_vocabulary_review_transition.sql` | Applied | Compare-and-swap review RPC. |
| `supabase/tests/vocabulary_rls_test.sql` | Active | pgTAP RLS coverage. |
| `content/vocabulary/` | Active source | Human-reviewable JSONL Vocabulary source. |
| `scripts/vocabulary/normalize-content.mjs` | Active | Canonical learner-payload normalizer. |
| `scripts/vocabulary/validate-content.mjs` | Active | Schema, baseline, translation/source-leak gate. |
| `scripts/vocabulary/import-*-to-supabase.mjs` | Active | Idempotent catalog/deck imports. |
| `scripts/vocabulary/generate-audio.mjs` | Active | Google TTS generation with refresh/retry/checkpoint. |
| `scripts/vocabulary/upload-audio-to-supabase.mjs` | Active | Approved audio upload; runtime remains gate-controlled. |

Runtime catalog needs `VOCABULARY_CONTENT_SOURCE=supabase`, Supabase URL, publishable key. Four beta decks contain 1,312 published cards. Audio stays off unless both `VOCABULARY_AUDIO_ENABLED=true` and `VOCABULARY_AUDIO_BASE_URL` are set.

## Tests, build, and CI

| Command / path | Scope |
|---|---|
| `npm test` | Hermetic SRS, queue, content, audio, identity, service, importer, route-coverage tests. |
| `VOCABULARY_INTEGRATION=1 npm run vocab:test-integration` | Real-project transaction, idempotency, RLS, stale-write, restart tests; creates anonymous test users. |
| `npm run vercel-build` | Prototype route verification, sync/handoff, Next build, generated types, typecheck. |
| `.github/workflows/vocabulary-content.yml` | Content gate, tests, app build/typecheck. |
| `.github/workflows/vocabulary-database.yml` | Local Supabase migration/RLS workflow. |

Branch protection must mark both workflows required (`VOC-INFRA-07`). Integration CI needs project secrets separately; never add service-role key to web runtime.

## Remaining boundaries

| Boundary | Current state |
|---|---|
| Other IELTS screens | Prototype only; move one route at a time into `apps/web/src/app/`. |
| Analytics and consent | Not implemented. Do not emit learner analytics before `VOC-PLAN-07`. |
| Audio release | Pipeline/upload done; pronunciation QA and durable backup pending. |
| Anonymous retention | 30-day policy accepted; scheduled deletion job not implemented. |
| Production deploy | Vercel Preview Comments setting, production Supabase redirect/Site URL, Google OAuth checklist pending. |
| E2E beta evidence | Not implemented against deployed URL (`VOC-QA-04`). |

## Change rules

- Schema change: migration, rollback note, pgTAP/RLS verification, integration evidence when learner writes change.
- Learner API change: update `schema.ts`, service/adapter tests, route error model, and client consumer.
- Prototype/app route change: update `scripts/app-routes.mjs`; sync and route verification must pass.
- Content change: normalize, validate, import, then publish accepted deck/card versions.
- Token change: update `design-tokens.json`, `DESIGN.md`, generated CSS, UI handoff.
- Architecture/privacy decision: update ADR/decision log and execution plan.
