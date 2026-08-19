# Changelog

Mọi thay đổi đáng chú ý của IELTS Cozy được ghi trong file này.

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/) và version theo [Semantic Versioning](https://semver.org/lang/vi/).

## [Unreleased]

### Added

- Static IELTS runtime: Home, Dashboard, Vocabulary flashcards, Grammar feedback, Listening demo, and Progress screen.
- Browser-local learning progress with dependency-free runtime verification for Vercel build.
- Architecture scaffold cho B2C IELTS MVP: Vocabulary, Grammar, Listening.
- Modular-monolith architecture: Next.js BFF, Supabase Auth/Postgres/Storage, anonymous learner session, immutable content version.
- Product Overview, PRD tiếng Việt, architecture docs, ADR-001, decision log, runbook, Code Map.
- Agentic workflow cho Claude, Codex, Antigravity: shared contract, context, task/handoff templates, review and release checks.
- Canonical Design System và DTCG-aligned Design Tokens dựa trên mockup.
- Mockup/reference assets tách riêng tại `references/mockup/`.

### Changed

- Reorganized repository into `apps/`, `packages/`, `content/`, `supabase/`, `docs/`, `references/`, `tests/`, `scripts/`, and agent configuration directories.
- Chuyển tài liệu product vào `docs/product/`.
- Chuyển Claude Design Skill vào `.claude/skills/ielts-cozy-design/`.

### Security

- Quy định guest-first identity, age gate/consent cho người dùng dưới 18 tuổi, RLS, signed audio URLs, và không gửi raw learner content vào analytics.

## [0.1.0] - 2026-08-19

### Added

- Initial IELTS Cozy interaction mockup and visual reference assets.
