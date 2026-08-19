# Shared Agent Contract

## Source priority

1. `index.html` for current deployed screen layout and interaction behavior
2. `docs/product/PRODUCT_SPEC.md` for product requirements beyond the current screen behavior
3. `DESIGN.md` and `design-tokens.json` for UI rules and token values
4. `docs/architecture/ARCHITECTURE.md`
5. `docs/architecture/DECISION_LOG.md`
6. `docs/adr/`
7. Task-specific acceptance criteria

For a visual or interaction conflict, `index.html` wins until product owner changes it. Stop and ask when a product, data, privacy, or architecture requirement conflicts.

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
