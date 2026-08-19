# IELTS Cozy Code Map

## Status

Static browser MVP is active at repository root. It provides local-only Vocabulary, Grammar, Listening demo, Dashboard, and Progress flows. Paths marked **planned** remain reserved for production Next.js and backend boundaries.

## Fast orientation

```text
Product rules      docs/product/PRODUCT_SPEC.md
Architecture       docs/architecture/ARCHITECTURE.md
Design rules       DESIGN.md
Design values      design-tokens.json
Agent protocol     AGENTS.md
Mockup reference   references/mockup/ielts-cozy.mockup.html
```

## Repository map

| Path | Status | Purpose |
|---|---|---|
| `apps/web/` | Planned | Next.js application, App Router, BFF API, UI |
| `index.html` | Active | Static runtime entry; renders current browser-only MVP |
| `styles.css` | Active | Runtime styles derived from canonical token values |
| `app.js` | Active | Hash navigation, deterministic practice interactions, local browser progress |
| `scripts/verify-static-runtime.mjs` | Active | Dependency-free build validation for runtime shell |
| `assets/images/` | Active | Runtime visual assets copied from approved mockup references |
| `apps/web/src/app/` | Planned | Routes, layouts, Route Handlers under `/api/v1` |
| `apps/web/src/features/` | Planned | Vertical feature modules |
| `apps/web/src/components/` | Planned | Shared UI only; no domain behavior |
| `apps/web/src/server/` | Planned | Auth, Supabase clients, storage adapters, services |
| `packages/ui/` | Planned | Reusable primitives built from Design Tokens |
| `packages/contracts/` | Planned | Shared Zod schemas, API types, content contracts |
| `packages/content-engine/` | Planned | Grammar/Listening scoring, SRS, recommendations |
| `supabase/migrations/` | Planned | Versioned database schema only |
| `supabase/seed/` | Planned | Local/staging demo data |
| `content/` | Planned | Validated Vocabulary, Grammar, Listening metadata |
| `references/mockup/` | Reference | Original visual/interaction prototype; never runtime import |
| `.agents/` | Active | Cross-agent context, workflows, handoff templates, quality checks |
| `.claude/skills/ielts-cozy-design/` | Active | Claude UI design skill |
| `docs/` | Active | Product, architecture, ADR, contracts, design, runbooks |
| `tests/e2e/` | Planned | Playwright end-to-end tests |

## Planned feature map

```text
apps/web/src/features/
├─ learner/          Guest/account identity, age gate, consent, preferences
├─ vocabulary/       Decks, cards, review queue, spaced repetition events
├─ grammar/          Exercises, answer validation, immediate explanations
├─ listening/        Audio session, questions, submissions, signed URLs
├─ progress/         XP, streak, dashboard summaries, recommendation inputs
└─ content-library/  Content catalog, filtering, publish visibility
```

Each feature owns `components/`, `actions.ts`, `service.ts`, `repository.ts`, `schema.ts`, `types.ts`, `tests/`, and a small README when implemented. Shared code moves to `packages/` only after two features need it.

## Request and data flow

```text
Browser / PWA
  → Next.js page or client interaction
  → Server Action or /api/v1 Route Handler
  → feature service
  → repository / storage adapter
  → Supabase Auth, Postgres, or Storage
```

The browser does not query product tables directly. All mutations validate input and use idempotency keys. Anonymous Auth UUID is learner identity until account registration links it.

## Key data relationships

```text
learner_profile → attempts → attempt_answers
content_item → content_version → questions / answer_keys
vocabulary_card → vocab_review → next_review_at
listening_lesson → audio_asset → signed playback URL
```

Published content is immutable. Attempts point to the content version used during completion.

## Current static runtime boundaries

- Browser-only demo data and `localStorage`; no user account, server, database, or analytics event is created.
- Listening control simulates playback because no licensed runtime audio asset exists yet.
- Grammar and Listening use deterministic demo answer keys; no AI scoring.
- Production implementation stays under planned `apps/web/` boundaries after Next.js/Supabase setup is authorized.

## Agent routing

| Work | Start here |
|---|---|
| Product behavior | `docs/product/PRODUCT_SPEC.md` |
| UI/design | `DESIGN.md`, `design-tokens.json`, Claude design skill |
| Architecture/data | `docs/architecture/ARCHITECTURE.md`, ADRs |
| Task planning/review | `.agents/workflows/plan-to-task.md`, `.agents/workflows/review-fix.md` |
| Implementation | `.agents/workflows/implementation.md` |
| Release | `docs/runbooks/release.md` |

Claude scopes and reviews tasks. Codex and Antigravity implement dynamically assigned, non-overlapping task scopes.

## Change rules

- Schema change: migration + RLS test + rollback note.
- Contract change: update consumer tests and document externally visible impact.
- Token change: update `design-tokens.json`, `DESIGN.md`, and handoff.
- Architecture change: create ADR before or with change.
- Mockup change: keep it in `references/mockup/`; never treat it as production code.
