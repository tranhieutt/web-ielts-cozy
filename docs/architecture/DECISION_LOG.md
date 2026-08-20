# Architecture Decision Log

| ID | Decision | Reason |
|---|---|---|
| D-01 | B2C, mobile-first, ~1,000 MAU | Defines cost and scale boundary |
| D-02 | MVP: Vocabulary, Grammar, Listening | Focus on learning foundation |
| D-03 | Guest-first with persistent database progress | Low entry friction without losing learning history |
| D-04 | Audio managed by product | Control delivery, metadata, and rights |
| D-05 | Support minors | Age gate, consent, and minimal-data defaults required |
| D-06 | No payment in MVP | Avoid subscription complexity before retention proof |
| D-07 | Modular monolith repository | Low operations cost; clear future extraction path |
| D-08 | Shared contract plus agent adapters | One source of truth for Claude, Codex, Antigravity |
| D-09 | Dynamic task allocation | Claude plans/reviews; Codex and Antigravity alternate implementation |
| D-10 | Next.js BFF + Supabase | Managed web, database, Auth, Storage fit MVP scale |
| D-11 | Immutable content versions | Preserve score/history correctness |
| D-12 | Anonymous Auth UUID as learner key | Supports guest progress and later account linking |
| D-13 | UI never directly accesses database | Central validation, audit, and security boundary |
| D-14 | Defer Vocabulary offline review queue | Vocabulary MVP is online-only for review writes; revisit after beta. See ADR-002. |
| D-15 | Attempt snapshots content version | Historical scoring remains reproducible |
| D-16 | Tests are merge gate | Protect learning progress and content correctness |
| D-17 | Local, preview, production environments | Avoid direct production experimentation |
| D-18 | CI + review gate production release | Safer small-team operations |
| D-19 | Managed observability first | Minimize DevOps load |
| D-20 | Vocabulary guest identity policy | Anonymous user retention 30d, passive header sign-in link, Google OAuth with manual linking, 50 anonymous sign-ins/hour/IP. See ADR-004. |
