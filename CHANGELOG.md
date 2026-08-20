# Changelog

Mọi thay đổi đáng chú ý của IELTS Cozy được ghi trong file này.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và version theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

### Added

- Vocabulary pull-request content gate (`vocabulary-content`) validates raw JSONL, builds and validates canonical learner catalog, and runs vocabulary contract tests on Node 20.
- Deterministic two-rating Vocabulary SRS domain function with all 16 specified transitions, UTC due dates, and unit coverage.
- Vocabulary validator tests and Google TTS token-refresh/retry tests.
- Vocabulary catalog and learner-state Supabase migration, RLS policies, pgTAP coverage, and GitHub local database-test workflow.
- Static IELTS runtime: Home, Dashboard, Vocabulary flashcards, Grammar feedback, Listening demo, and Progress screen.
- Browser-local learning progress with dependency-free runtime verification for Vercel build.
- Architecture scaffold cho B2C IELTS MVP: Vocabulary, Grammar, Listening.
- Modular-monolith architecture: Next.js BFF, Supabase Auth/Postgres/Storage, anonymous learner session, immutable content version.
- Product Overview, PRD tiếng Việt, architecture docs, ADR-001, decision log, runbook, Code Map.
- Agentic workflow cho Claude, Codex, Antigravity: shared contract, context, task/handoff templates, review and release checks.
- Canonical Design System và DTCG-aligned Design Tokens dựa trên mockup.
- Root `index.html` là nguồn giao diện và tương tác duy nhất; runtime assets tách tại `assets/`.

### Changed

- Vocabulary content validation now hard-fails unless source totals are exactly 23 files, 5,275 unique cards, and 7,309 Vietnamese definitions; canonical output rejects Chinese fields and Youdao URLs.
- Google TTS generation refreshes expiring tokens and retries one HTTP 401 with a fresh token while preserving resumable audio generation.
- Optimized runtime imagery: responsive WebP hero and lazy-loaded card `srcset` variants replace PNG assets.
- Root runtime now renders full 11-screen Design Code mockup; runtime assets are served from `assets/`.
- Reorganized repository into `apps/`, `packages/`, `content/`, `supabase/`, `docs/`, `references/`, `tests/`, `scripts/`, and agent configuration directories.
- Chuyển tài liệu product vào `docs/product/`.
- Chuyển Claude Design Skill vào `.claude/skills/ielts-cozy-design/`.

### Security

- Quy định guest-first identity, age gate/consent cho người dùng dưới 18 tuổi, RLS, signed audio URLs, và không gửi raw learner content vào analytics.

## [0.1.0] - 2026-08-19

### Added

- Initial IELTS Cozy interaction mockup and visual reference assets.
