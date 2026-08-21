# Changelog

Mọi thay đổi đáng chú ý của IELTS Cozy được ghi trong file này.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và version theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

### Fixed

- The deck catalog no longer fetches the published corpus to count it. It pulled every card of every published deck — 1,735 rows across four decks — purely to call `.length`, which put `/api/vocabulary/decks` at 2.5–3.8s against the 3s budget and would have degraded with each deck published. Counts now come from the `vocabulary_deck_summary` view and only the learner's own rated cards are mapped to decks, so the first screen costs what the learner has studied rather than what the catalog holds: 0.39s for decks (~7x faster) and 0.58s for progress (~4x).

- Paginated the beta-publish membership read. PostgREST caps an unbounded select at 1,000 rows, so the first draft of the script saw 975 of 1,642 cards and would have published decks that were silently missing 40% of their content.

- Dropped a redundant card-existence pre-check from review submission. The deployed RPC already checks the card inside the transaction that writes, so the extra read was both a wasted round trip and a TOCTOU gap; both adapters now resolve an unknown card at the same point.

- Recovered seven schema migrations that had been applied to production without a committed migration file (`vocabulary_deck_summary` and six iterations of `submit_vocabulary_review`). The repo now matches the deployed schema exactly, and `supabase db push`/`db pull` work again instead of refusing on a history conflict.
- Withdrew a locally written `submit_vocabulary_review` migration that would have regressed production: it shared the deployed function's argument types, so `create or replace` would have silently dropped the compare-and-swap guard, the per-row lock, and the PT409 conflict signal.

### Added

- A rollback and backup runbook for Vocabulary (VOC-QA-08), covering content unpublish, content-version restore, migration rollback, learner data, and the audio artifact — including the traps found in practice: an upsert restore leaves stale cards behind, and `submit_vocabulary_review` must never be dropped as a rollback step.
- Playwright E2E suite for the core learner journeys (VOC-QA-04), covering all eight journeys in the task. It has not been executed yet — see the execution plan for why and what remains.

- Self-service deletion of learner study data (VOC-WEB-10, ADR-004): a confirmation step that names what disappears and that it cannot be undone, backed by a `delete_my_vocabulary_data()` function that removes states and review events in one transaction. The function takes no arguments at all — the learner comes from `auth.uid()` — so there is no parameter anyone could point at another learner's rows. The control is absent during a review session, where it would sit next to the rating buttons.
- A footer on every Vocabulary screen linking to account information (VOC-WEB-09). Per ADR-004 it is an offer, not a prompt: no banner, no modal, no post-session interruption. Account linking itself is not built yet and the page says so rather than showing a control that cannot work.

- Integration coverage for the review write against a real project (VOC-QA-02): proves what a stubbed `fetch` cannot — the event and the state commit as one transaction, a replayed key persists exactly one event, two concurrent ratings of the same card produce exactly one winner with no orphaned event from the loser, and RLS refuses to widen even when another learner's id is passed explicitly. Run with `npm run vocab:test-integration`, which sets the opt-in flag itself so the command works on PowerShell as well as bash; every anonymous learner it creates is deleted afterwards.

- Vocabulary beta content is live: General Academic, Environment, Technology and Education (1,642 cards) are published; the other 19 decks stay draft and remain invisible to learners even where they share an already-published card. `npm run vocab:publish-beta` applies the list and `--unpublish` reverses it.
- Vocabulary now runs end-to-end on Supabase: anonymous sign-in, deck catalog, review queue, and review submission all verified against the live project, and learner progress survives a server restart (VOC-07).

- Compare-and-swap on review writes: the state a transition was computed from is sent as `expected`, so a rating computed from stale state is refused (HTTP 409) instead of overwriting a newer state written by another session. Both adapters enforce it, so fixture tests mean something about production.
- Real learner identity for Vocabulary (VOC-API-01): Supabase Anonymous Auth over GoTrue REST mints the learner UUID on first visit per D-12, reuses a live access token, refreshes ahead of expiry with a 60s skew, and stores both tokens in httpOnly cookies so page scripts cannot read them. A dead refresh token mints a new learner rather than pretending the old session survived. Not yet exercised against a real project.
- Guest identity and retention policy for Vocabulary (ADR-004, closes VOC-PLAN-05): the anonymous UUID stays the learner id per D-12, inactive guests are kept 3 months, account creation is a footer link rather than a prompt, device recovery works by linking an OAuth identity (`enable_manual_linking`), the anonymous rate limit is raised to 50/hour/IP because learners share IPs, and a learner can delete their own data from inside the app.
- Supabase data adapter for Vocabulary (VOC-API-02s/03s/05s): PostgREST reads over the learner's own access token so RLS — not application code — enforces isolation, no service-role path, and a `submit_vocabulary_review` RPC that lands the review event and the learner state in one transaction with idempotency decided by the unique `(learner_id, idempotency_key)` constraint. Not yet runnable: it needs a learner token (VOC-API-01) and seeded content (VOC-DATA-07a), and the migration is unapplied.
- Explicit Vocabulary data seam (`repository.ts`) with a `VOCABULARY_DATA_SOURCE` selector defaulting to `fixture`; a half-configured Supabase environment now raises instead of silently serving fixture data.
- Keyboard and screen-reader support for the review session: focus moves to the next card after a rating instead of dropping to the document body, a live region announces the new card, and each screen carries a single heading.
- Vocabulary audio release gate (ADR-003): audio is served only when `VOCABULARY_AUDIO_ENABLED=true` and an approved `VOCABULARY_AUDIO_BASE_URL` are both set, defaults to off, and a closed gate omits the field instead of emitting URLs that fail.
- Pronunciation controls on the flashcard: no autoplay, per-accent accessible names, 44px targets, an explicit unavailable state while the gate is closed, and a playback error that never interrupts the review.
- Vocabulary review vertical slice: `apps/web` Next.js workspace (D-10) serving `/vocabulary` and `/vocabulary/review` end-to-end against fixture content — deck catalog, flashcard flip, two-rating review, and session summary.
- Vocabulary API on fixture data: deck catalog, review queue (`due`/`new`, server-side limit cap), idempotent review submission, and learner progress endpoints.
- In-session review queue domain function (spec §8.3): re-inserts an `again` card behind exactly three unrated cards, caps re-inserts at two per card, never reads `due_at`, with unit coverage for VOC-06b.
- Design token CSS generator deriving 105 custom properties from `design-tokens.json`, including DTCG shadow and cubic-bezier composites; feature CSS references tokens only.
- Vertical-slice fixture builder running 20 Environment cards through the canonical normalizer, so fixture content cannot drift onto a different contract.
- Vocabulary feature README recording invariants, the data-adapter seam, and the fixture's limits.
- Vocabulary content gate (`vocabulary-content`) validates raw JSONL, builds and validates the canonical learner catalog, typechecks and builds the web app, and runs the full test suite.
- Deterministic two-rating Vocabulary SRS domain function with all 16 specified transitions, UTC due dates, and unit coverage.
- Vocabulary validator tests and Google TTS token-refresh/retry tests.
- Vocabulary catalog and learner-state Supabase migration, RLS policies, pgTAP coverage, and GitHub local database-test workflow.
- Draft Vocabulary deck importer maps canonical cards into 23 Vietnamese-named decks and 8,271 shared-card memberships, with deck/card catalog versions kept in sync.
- Static IELTS runtime: Home, Dashboard, Vocabulary flashcards, Grammar feedback, Listening demo, and Progress screen.
- Browser-local learning progress with dependency-free runtime verification for Vercel build.
- Architecture scaffold cho B2C IELTS MVP: Vocabulary, Grammar, Listening.
- Modular-monolith architecture: Next.js BFF, Supabase Auth/Postgres/Storage, anonymous learner session, immutable content version.
- Product Overview, PRD tiếng Việt, architecture docs, ADR-001, decision log, runbook, Code Map.
- Agentic workflow cho Claude, Codex, Antigravity: shared contract, context, task/handoff templates, review and release checks.
- Canonical Design System và DTCG-aligned Design Tokens dựa trên mockup.
- Root `index.html` là nguồn giao diện và tương tác duy nhất; runtime assets tách tại `assets/`.

### Changed

- Vocabulary screens verified in-browser at 360px and desktop: no horizontal overflow, no control under 44px, every control named, focus ring rendered from tokens, and all ten text/background pairs at or above WCAG AA.
- Vocabulary CI now runs every test (SRS schedule, session queue, importer, service), typechecks and builds `apps/web`, triggers on push to `main`, and watches `apps/**` and `test/**`; runner moved to Node 24 and `engines.node` to `>=22.18.0` for TypeScript type stripping.
- Vocabulary domain modules moved from `src/` to `apps/web/src/features/vocabulary/`, matching the documented feature-module contract.
- Vocabulary spec closed five ambiguities: session completion definition and the `completion_reason` enum; "publishable" as card published AND deck published; idempotent retries must replay the first result rather than conflict; `session_id` on every analytics event; `interval_days` replaced by `next_stage` + `interval_minutes`.
- Vocabulary execution plan split `VOC-DATA-07` into dev/staging seed (`07a`, unblocked) and beta publish (`07b`, product-gated), so the beta-deck decision no longer sits on the M2/M3 critical path; added `VOC-INFRA-06/07/08`, `VOC-API-04b`, `VOC-QA-01b`, split fixture and Supabase API tasks, and marked completed work with strikethrough.
- Vocabulary content validation now hard-fails unless source totals are exactly 23 files, 5,275 unique cards, and 7,309 Vietnamese definitions; canonical output rejects Chinese fields and Youdao URLs.
- Vocabulary execution plan and content runbook now record catalog/deck import status, dry-run command, and beta-publish gate.
- Google TTS generation refreshes expiring tokens and retries one HTTP 401 with a fresh token while preserving resumable audio generation.
- Optimized runtime imagery: responsive WebP hero and lazy-loaded card `srcset` variants replace PNG assets.
- Root runtime now renders full 11-screen Design Code mockup; runtime assets are served from `assets/`.
- Reorganized repository into `apps/`, `packages/`, `content/`, `supabase/`, `docs/`, `references/`, `tests/`, `scripts/`, and agent configuration directories.
- Chuyển tài liệu product vào `docs/product/`.
- Chuyển Claude Design Skill vào `.claude/skills/ielts-cozy-design/`.

### Security

- Audio delivery cannot be switched on by a data edit: the release gate is deploy-time configuration, so mis-pronounced heteronyms cannot reach learners before pronunciation QA (`VOC-PLAN-08`) passes.
- Vertical-slice learner identity is an unsigned first-party cookie and learner state lives in process memory: it proves nothing about the caller, does not survive a restart, and must not be pointed at real learners. Supabase Anonymous Auth (D-12) and the database adapter replace both.
- Slice API payloads are asserted free of Chinese source fields and Youdao audio URLs on the real fixture content (VOC-08).
- Quy định guest-first identity, age gate/consent cho người dùng dưới 18 tuổi, RLS, signed audio URLs, và không gửi raw learner content vào analytics.

## [0.1.0] - 2026-08-19

### Added

- A rollback and backup runbook for Vocabulary (VOC-QA-08), covering content unpublish, content-version restore, migration rollback, learner data, and the audio artifact — including the traps found in practice: an upsert restore leaves stale cards behind, and `submit_vocabulary_review` must never be dropped as a rollback step.
- Playwright E2E suite for the core learner journeys (VOC-QA-04), covering all eight journeys in the task. It has not been executed yet — see the execution plan for why and what remains.

- Self-service deletion of learner study data (VOC-WEB-10, ADR-004): a confirmation step that names what disappears and that it cannot be undone, backed by a `delete_my_vocabulary_data()` function that removes states and review events in one transaction. The function takes no arguments at all — the learner comes from `auth.uid()` — so there is no parameter anyone could point at another learner's rows. The control is absent during a review session, where it would sit next to the rating buttons.
- A footer on every Vocabulary screen linking to account information (VOC-WEB-09). Per ADR-004 it is an offer, not a prompt: no banner, no modal, no post-session interruption. Account linking itself is not built yet and the page says so rather than showing a control that cannot work.

- Integration coverage for the review write against a real project (VOC-QA-02): proves what a stubbed `fetch` cannot — the event and the state commit as one transaction, a replayed key persists exactly one event, two concurrent ratings of the same card produce exactly one winner with no orphaned event from the loser, and RLS refuses to widen even when another learner's id is passed explicitly. Run with `npm run vocab:test-integration`, which sets the opt-in flag itself so the command works on PowerShell as well as bash; every anonymous learner it creates is deleted afterwards.

- Vocabulary beta content is live: General Academic, Environment, Technology and Education (1,642 cards) are published; the other 19 decks stay draft and remain invisible to learners even where they share an already-published card. `npm run vocab:publish-beta` applies the list and `--unpublish` reverses it.
- Vocabulary now runs end-to-end on Supabase: anonymous sign-in, deck catalog, review queue, and review submission all verified against the live project, and learner progress survives a server restart (VOC-07).

- Initial IELTS Cozy interaction mockup and visual reference assets.
