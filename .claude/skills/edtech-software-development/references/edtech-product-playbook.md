# EdTech product delivery playbook

## Scope

Reusable route from an early B2C learning-product idea to Git-ready project foundation. Designed for teams using Claude for planning and review, then Codex and Antigravity for scoped implementation. Adapt roles when team model differs.

## Phase 0 — Intake and guardrails

Capture:

- Product idea and learning outcome.
- Learner age, level, locale, device, and accessibility needs.
- Business model now and later.
- Initial and expected usage volume.
- Content origin, copyright status, editorial workflow, and retention rules.
- Capabilities explicitly out of scope.

Output: `docs/product/PRODUCT_OVERVIEW.md`.

Exit when user accepts MVP boundary. Do not select stack or build screens first.

## Phase 1 — Product framing

Define learner loop in plain language:

1. Learner chooses goal or activity.
2. System delivers a small learning unit.
3. Learner practises and submits response.
4. System gives deterministic feedback or result.
5. System schedules review and visualizes progress.

For each MVP feature, record problem, user story, acceptance criteria, events, data created, failure states, and exclusion. Prefer small vertical slices over feature inventory.

Example IELTS B2C MVP: vocabulary, grammar practice, listening exercises, guest-first onboarding, local learning continuity, database-backed progress. Defer AI scoring, speaking evaluation, payment, social feeds, and high-risk external integrations unless approved.

Output: PRD in `docs/product/PRODUCT_SPEC.md`.

## Phase 2 — Prototype with Claude Design

Give Claude Design a brief containing:

- Product name, learner group, and one primary scenario.
- Required screens and transitions.
- Visual personality plus prohibited styles.
- Design tokens or existing brand constraints if available.
- Realistic sample learning content; no lorem ipsum for assessment interaction.
- Mobile and desktop behavior, focus states, empty/loading/error/success states.

Export HTML, link, or screenshots. Store immutable source under `references/mockup/` with README noting origin and date. Do not copy prototype CSS into production. Audit prototype for missing information architecture, impossible interactions, unhandled feedback, and accessibility gaps.

Output: prototype source and screen inventory.

## Phase 3 — PRD from prototype

Map each visible page to purpose, route, user state, data, key interactions, and acceptance criteria. Add product requirements prototype cannot prove: identity, progress persistence, content versioning, authorization, user privacy, performance, events, recovery, and admin/editor needs.

Use requirement labels:

- `Prototype-derived`: visible or directly implied by artifact.
- `Product decision`: chosen by owner/team.
- `Assumption`: reasonable but awaiting confirmation.

Output: completed PRD plus open decisions.

## Phase 4 — Architecture decision

Start with constraints, not favorite technology. Compare options in decision log.

Typical early B2C EdTech option:

- Next.js modular monolith for UI, BFF, and server operations.
- Managed relational database with auth and storage, such as Supabase.
- Content stored in first-party system with versioning and editorial ownership.
- Anonymous/guest identity from day one when learners must begin before sign-up.

Define modules: identity, content catalog, learning session, assessment, progress, review queue, analytics, administration. Define data model: user/guest identity, content item/version, exercise, attempt, answer, score, progress, review schedule, asset.

Choose modular monolith for low operational burden until independent scaling or team boundaries justify services. Set scale triggers, such as background processing needs, disproportionate media traffic, or independently deployed domain capability.

Output: `docs/architecture/ARCHITECTURE.md`, decision log, ADR for irreversible choices, database/schema plan.

## Phase 5 — Design system

Create one canonical system:

- `DESIGN.md`: principles, visual system, layout, interaction, accessibility, component guidance.
- `design-tokens.json`: DTCG-aligned raw and semantic tokens.
- Project design skill: concise rules agents must follow for UI tasks.

Separate core palette from semantic intent. Token names describe role, not current color. Verify contrast and focus visibility. Attribute or remove protected branding references. Reference mockup as inspiration, never as canonical source after system is approved.

Output: validated token JSON and documented source hierarchy.

## Phase 6 — Agentic project setup

Create lightweight operating system for agents:

- Root instruction files for Claude, Codex, and Antigravity.
- `.agents/context/` for source-of-truth, system map, and domain glossary.
- `.agents/workflows/` for plan-to-task, implementation, review/fix, and release.
- `.agents/templates/` for task, handoff, and decision records.
- `.agents/checks/` for definition of done and review rubric.

Set source priority: PRD → design docs for UI → architecture → decision log/ADR → task. In handoff, identify owned paths, tested behavior, risks, and decision needed. Do not make person-based folder ownership mandatory unless team requests it.

Output: agent instructions plus discoverable team context.

## Phase 7 — Repository scaffold and documentation

Use structure matching planned boundaries, not a fictitious finished app. Typical layout:

```text
apps/                 deployable applications
packages/             shared UI, domain, config packages
content/              first-party learning content and schema
supabase/             migrations, seed, policies
docs/                 product, design, architecture, contracts, ADRs, runbooks
references/mockup/    preserved prototype artifacts
scripts/              maintenance and validation scripts
tests/                cross-cutting test harnesses
```

Add `PROJECT_STRUCTURE.md` and `CODEMAP.md`. State “planned” versus “implemented” clearly. Add `CHANGELOG.md` from beginning; use Unreleased section.

Output: documented empty scaffold, no premature application code.

## Phase 8 — Git setup

Checklist:

1. Inspect `git status`, remotes, branch, and tracked sensitive files.
2. Add/review `.gitignore` for dependencies, builds, environment files, temporary artifacts, and local tool state.
3. Initialize Git only if repository absent.
4. Add remote only after verifying repository URL and intended branch.
5. Stage specific project artifacts; inspect staged diff.
6. Commit conventional, descriptive foundation message.
7. Push selected branch; verify upstream tracking and remote log.

Stop for direction if remote contains unexpected work or command requires force, reset, deletion, credentials, or history rewrite.

## Phase 9 — Handoff to implementation

Before code, produce vertical-slice plan with order, owned paths, API/data contracts, test approach, and acceptance criteria. Confirm user authorizes implementation.

Suggested first slice: guest learning session → load published vocabulary/grammar/listening exercise → submit deterministic answer → persist attempt/progress → show result and next review. Keep AI scoring and speaking out until separately approved.

## Completion checklist

- Learner, outcome, MVP, non-goals, and success measures documented.
- Prototype source preserved and converted into traceable requirements.
- PRD, architecture, decisions, and design system agree.
- Content ownership and user-data model defined.
- Agent context, scaffold map, code map, and changelog present.
- Git remote, initial commit, and upstream verified.
- Implementation explicitly authorized before runtime code begins.
