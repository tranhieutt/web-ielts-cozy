# Changelog

Mọi thay đổi đáng chú ý của IELTS Cozy được ghi trong file này.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và version theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

### Added

- Supabase Anonymous Auth as the learner identity (D-12, ADR-004): the first request mints a real `auth.users` UUID that IS the `learner_id`, carried in httpOnly cookies, so Row Level Security enforces isolation instead of application code.
- Google sign-in that links onto the learner's existing anonymous UUID rather than authenticating a new user, so progress earned before signing in is kept; the code is exchanged server-side with PKCE so tokens never reach a URL fragment.
- Durable, transactional review writes: the `submit_vocabulary_review` function records the review event and updates learner state in a single transaction, with idempotency enforced by a unique `(learner_id, idempotency_key)` constraint rather than application logic. Progress now survives a restart.
- A passive sign-in link and an explicit "progress is stored in this browser" note on the vocabulary catalog, delivering the affordances ADR-004 committed to so an anonymous learner can actually keep their progress.
- Integration coverage for the review write against the real project: transactionality, replay, concurrent requests collapsing to one event, cross-learner isolation, rejection of unpublished cards, and refusal to write without a session.

- `vocabulary_deck_summary` view returning the deck catalog and its publishable card counts in one request, declared `security_invoker` so Row Level Security still governs what each caller sees.
- Real Vocabulary catalog in Supabase: 5,275 cards, 23 decks and 8,271 memberships imported, with the four beta decks (Environment, Education, Technology, General Academic) published as 1,312 cards.
- Supabase content adapter reading through PostgREST with the publishable key so Row Level Security decides what a learner can see; `VOCABULARY_CONTENT_SOURCE` selects it, and the checked-in fixture still backs tests and offline work.
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

- The Next application now serves the whole domain: `/vocabulary` is the real app, and the nine screens without a real page yet are rewritten to the design-canvas prototype, which is synced into the app at build time so the repo-root export stays the only source of truth.
- The static runtime check now asserts that every route the prototype can navigate to is served by something — a rewrite or a real page — replacing the obsolete single-page rewrite assertion.

- The deck catalog no longer downloads every card to count them. Measured against the real project, the database answers a count in ~2ms while a round trip costs ~600ms, so the catalog was rebuilt around one request instead of one per deck; learner progress now fetches only the cards a learner has actually rated.
- The dashboard's primary call to action now targets a deck chosen from the data (first deck with due cards, else the largest) instead of a hard-coded slug, which only surfaced once more than one deck existed.
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

### Fixed

- Two reviews of the same card could both compute their transition from the same state and both write it, costing the learner a stage while counting two reviews. The state update is now a compare-and-swap against the state the caller read, and a lost race answers 409 so the caller re-reads and retries.
- The learner's session was not written back when starting Google sign-in, so a refresh-token rotation followed by cancelling on Google's screen left the browser holding dead credentials and stranded the learner's progress.
- `/api/vocabulary/progress` fetched learner state twice per request — once directly and once inside the deck catalog — adding a full Supabase round trip to every catalog load.
- A card whose `topics_all` already contains its primary topic was counted twice in per-deck progress, inflating a learner's totals (VOC-03).

### Security

- The web app's environment carries the publishable key only; the service-role key stays with the local import scripts and never reaches the app runtime.
- Cards are published by primary topic, so a card whose own deck has not passed translation audit cannot appear through a secondary membership in a published deck.
- Audio delivery cannot be switched on by a data edit: the release gate is deploy-time configuration, so mis-pronounced heteronyms cannot reach learners before pronunciation QA (`VOC-PLAN-08`) passes.
- Vertical-slice learner identity is an unsigned first-party cookie and learner state lives in process memory: it proves nothing about the caller, does not survive a restart, and must not be pointed at real learners. Supabase Anonymous Auth (D-12) and the database adapter replace both.
- Slice API payloads are asserted free of Chinese source fields and Youdao audio URLs on the real fixture content (VOC-08).
- Quy định guest-first identity, age gate/consent cho người dùng dưới 18 tuổi, RLS, signed audio URLs, và không gửi raw learner content vào analytics.

## [0.1.0] - 2026-08-19

### Added

- Initial IELTS Cozy interaction mockup and visual reference assets.
