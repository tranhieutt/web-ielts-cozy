# Shared Agent Contract

## Source priority

1. `docs/product/PRODUCT_SPEC.md`
2. `DESIGN.md` and `design-tokens.json` for UI work
3. `docs/architecture/ARCHITECTURE.md`
4. `docs/architecture/DECISION_LOG.md`
5. `docs/adr/`
6. Task-specific acceptance criteria

If sources conflict, stop and ask for a decision. Do not silently choose.

## Delivery rule

- Claude creates or approves task scope and acceptance criteria.
- Codex or Antigravity implements one scoped task at a time.
- Claude reviews changes, tests, and risks before merge.
- Do not change database schema without migration, rollback note, and RLS test.
- Do not expose service-role keys, learner data, raw audio, writing text, or transcripts.

## Quality rule

- Keep business logic inside feature modules or shared packages.
- Validate input at server boundaries.
- Add or update tests for changed behavior.
- Record architectural changes in an ADR.
- Hand off using `.agents/templates/handoff.md`.
