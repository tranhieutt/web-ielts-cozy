# EdTech implementation loop

Read after implementation authorization. Use alongside existing product, architecture, ADR, design, and handoff documents; those documents override this generic guide.

## Slice contract

Plan one narrow loop before expanding screens or content volume:

1. Select only published learning content.
2. Resolve one learner identity.
3. Build a due/new queue from deterministic domain rules.
4. Submit an answer or rating with an idempotency key.
5. Store event and derived learner state in one transaction.
6. Reload through the real authorization path and show resulting progress.

For each boundary record request/response examples, error model, privacy classification, test command, and rollback or recovery behavior. Keep domain scheduling code pure; route handlers parse and map errors; repositories own storage queries.

## Content and media pipeline

Use a reproducible pipeline:

```text
authoring source -> validate -> normalize/version -> import -> draft -> QA -> published -> runtime read
```

Validate schema, stable IDs, duplicates, required translations or fallbacks, asset references, and publication status. Import into a staging or draft state first. Test repeat imports and publish only accepted content.

For audio or generated assets, separately prove source rights, object delivery, playback, human quality, backup, and restore. Default runtime feature gate to off; omit unavailable asset fields instead of returning broken URLs.

## Identity and learner state

For guest-first products, use the auth provider's anonymous user ID as learner key when RLS depends on provider identity. Define retention, deletion cascade, device-boundary copy, upgrade/link behavior, rate limit, and user-visible failure state.

Never replace durable authorization with an unsigned cookie. A cookie-only ID can support isolated local fixtures, but must be visibly non-production and must not reach a shared learner database.

Persist an immutable attempt/review event and updated projection together. Enforce idempotency at storage boundary, so retries return the original result rather than applying scheduling twice. Verify another learner cannot read or write the data through RLS, not only through application code.

## Migration sequence

Use adapter seams to avoid rewriting UI during infrastructure migration:

```text
fixture loop -> real catalog read -> real identity -> transactional learner writes -> remove fixture from production path
```

Keep the endpoint contract stable while switching adapters. Do not call a slice durable until real writes survive browser reload and server/process restart. Measure against real corpus and network conditions; optimize request count before complex caching when remote latency dominates.

## Evidence matrix

| Risk | Required evidence |
| --- | --- |
| Bad content | validator output, importer test, content QA manifest |
| Cross-learner data leak | migration review, RLS test, deployed verification |
| Double scheduling | idempotency test and transaction test |
| Lost learner progress | authenticated reload and restart test |
| Broken/unlicensed audio | gate-off test, delivery probe, QA record, backup/restore proof |
| Framework regression | clean application build before typecheck, route/service tests |
| Unusable learning flow | mobile, keyboard, screen-reader/a11y and core E2E evidence |
| Unenforced release policy | CI status plus administrator confirmation of branch protection or provider setting |

## Handoff and beta gate

Hand off only scoped paths. State requirement IDs, contracts changed, fixture/temporary seams remaining, exact checks run, external controls waiting on another owner, rollback path, and decisions needed.

Require code evidence and operational evidence before beta: content/publication acceptance, RLS, persistence, E2E, accessibility, performance, analytics consent, asset QA, rollback, and backup restore. Treat missing credentials, provider settings, retention jobs, or branch protection as explicit release blockers, not engineering TODOs.
