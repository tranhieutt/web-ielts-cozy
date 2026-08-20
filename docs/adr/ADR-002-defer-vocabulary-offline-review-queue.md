# ADR-002: Defer Vocabulary Offline Review Queue

## Status

Accepted — 2026-08-20

## Context

Vocabulary MVP needs durable review events, deterministic spaced repetition, idempotent retries, and RLS isolation. An offline mutation queue adds IndexedDB persistence, sync ordering, retry/backoff, duplicate prevention, conflict handling, and E2E coverage before those core paths are proven.

Fast beta delivery is higher priority than offline review in this release. Audio remains online-only and is not downloaded for offline use.

## Decision

Defer offline review/answer mutation queues beyond Vocabulary MVP.

When offline, learner may read an already-loaded card but cannot submit `Chưa thuộc` or `Thuộc rồi`. Keep learner on current card, disable rating controls, and explain that an internet connection is required to save progress. Never show a review as saved until server confirmation succeeds.

## Consequences

### Positive

- Smaller first release: no IndexedDB mutation schema, sync worker, conflict policy, or offline E2E matrix.
- Review state remains server-confirmed and transactionally consistent.
- Audio delivery stays simple and online-only.

### Negative

- Learner cannot rate cards during a network outage.
- Offline retention benefit is deferred.

## Revisit trigger

Reconsider after Vocabulary beta proves the online review path, or when offline usage becomes a measured learner need. A later ADR must define queue persistence, ordering, conflict handling, idempotency, and test coverage before implementation.

## Related decisions

- Supersedes D-14 for Vocabulary MVP only.
- Complements D-12 (anonymous learner identity), D-13 (UI never directly accesses database), D-16 (tests are merge gate), and D-18 (CI + review gate production release).
