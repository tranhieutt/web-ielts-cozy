# Contracts

Contracts define data and API boundaries shared by implementation agents.

- Runtime input/output validation lives in `packages/contracts`.
- Database model changes live in Supabase migrations.
- Content schemas validate Vocabulary, Grammar, and Listening material before publishing.
- A contract change must update consumer tests and its ADR when externally visible.
