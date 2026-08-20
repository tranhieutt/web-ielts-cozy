---
name: edtech-software-development
description: Guide a B2C EdTech product from idea through prototype, PRD, architecture, design system, repository setup, validated vertical-slice implementation, and beta readiness. Use for new learning-product discovery, planning, or building a learning loop with durable learner state, content operations, and release evidence.
---

# EdTech Software Development

## Purpose

Use this workflow to turn an EdTech idea into approved, traceable foundation, then an evidence-backed learning loop when implementation is authorized. Keep planning, design, architecture, repository setup, and implementation gates distinct.

Read `references/edtech-product-playbook.md` before beginning. Use existing repository documents as source of truth when present.
After implementation is authorized, also read `references/edtech-implementation-loop.md`.

## Operating rules

- Confirm product scope, learner, platform, content source, scale, and monetization before choosing architecture.
- State assumptions. Ask only questions that materially alter product direction.
- Treat prototype as visual and interaction evidence; never treat it as production source code.
- Do not start application implementation unless user explicitly authorizes it.
- Treat fixture or in-memory learner state as a contract seam, never as persistence proof.
- Prove each completed task with test, migration/RLS check, delivery probe, or reviewed artifact; prose and a green local screen alone are not proof.
- Gate analytics, external media, and identity/account linking closed by default until their privacy, licensing, and recovery conditions pass.
- Preserve user-owned worktree changes. Never rewrite unrelated files.
- Keep brand, tokens, and component rules in canonical design documents; avoid duplicate sources of truth.
- Record decisions, rejected alternatives, and rationale in ADR or decision log.

## Workflow

### 1. Frame idea

Create product overview. Define learner segment, job-to-be-done, problem, promise, MVP boundary, success signals, non-goals, constraints, and major risks.

For B2C learning products, distinguish learning loop from content operations: discover, learn, practise, receive feedback, review, and track progress.

### 2. Direct Claude Design prototype

Write prototype brief with target learner, screen list, primary journey, visual direction, accessibility requirements, content examples, and explicit exclusions.

Request shareable prototype/export. Store source artifact under `references/mockup/` or equivalent. Capture screenshots only as supporting evidence. Inventory every screen, navigation item, CTA, state, and component before writing specification.

### 3. Produce product specification

Convert prototype evidence into PRD. Include information architecture, functional requirements, user stories with acceptance criteria, learner journey, content model, edge states, analytics, non-functional requirements, MVP exclusions, and open questions.

Mark every requirement as either prototype-derived, product decision, or assumption. Do not invent functionality because a mockup is visually attractive.

### 4. Choose architecture

Compare at least two viable options against expected MAU, team capability, delivery speed, operational cost, content workflows, privacy, and future extensibility.

For early B2C EdTech around roughly 1,000 monthly learners, default to modular monolith unless constraints prove otherwise. Document chosen boundaries, data ownership, authentication, content delivery, progress tracking, observability, security baseline, and scale triggers.

### 5. Establish design system

Use prototype as reference, then create canonical `DESIGN.md` and DTCG-style `design-tokens.json`. Define primitives, semantic tokens, typography, spacing, radius, shadows, motion, responsive behavior, accessibility, and component anatomy.

Create project-local design skill only when design rules need repeatable enforcement. Remove unlicensed, proprietary, or obsolete palette references from canonical design files.

### 6. Create agentic repository foundation

Add agent instructions and reusable context before implementation. Include source-of-truth order, product/domain map, task and handoff templates, planning/review workflows, quality gates, and role conventions.

If several agents work together, keep task ownership flexible while making handoffs explicit. Example: Claude owns specifications, plans, reviews, and bug fixes; Codex and Antigravity implement scoped tasks in rotation.

### 7. Normalize project structure

Create only folders needed for planned delivery: applications, shared packages, content, database migrations, docs, references, scripts, tests, and agent context. Add project structure map and code map describing current scaffold versus planned code.

### 8. Establish version control

Audit worktree and remote before staging. Add `.gitignore`; initialize repository only if needed; set remote deliberately; stage intended files; review status and diff; commit with descriptive message; push intended branch; verify tracking and remote state.

Never expose credentials or commit local secrets. Do not force-push, reset, or overwrite remote history unless user explicitly asks.

### 9. Plan and build one vertical learning slice

After explicit authorization, choose smallest learner loop that exercises real boundaries: discover published content, begin activity, submit response, receive deterministic feedback, persist progress, reload, and continue.

Give every task an owner, requirement ID, owned paths, API/data contract, acceptance criteria, test command, and handoff. Keep pure learning logic separately testable from route, repository, and UI adapters.

Implement in dependency order: content/read model, identity, transactional learner write, UI, then observability. Preserve stable endpoint contracts while replacing a fixture adapter with real infrastructure.

### 10. Build content and asset operations

Treat authoring files as input, not runtime API. Validate, normalize, version, import, and publish content through an explicit draft-to-published state. Test importer idempotency, stable IDs, duplicate detection, and representative content quality.

Treat generated audio and other large assets as release artifacts. Keep a safe-off runtime gate, publish only after delivery and human-quality checks, retain a restorable backup, and never expose unapproved asset URLs.

### 11. Make learner state durable and isolated

Use provider-issued guest/authenticated identity as learner key when progress must persist. Avoid unsigned browser identifiers in front of durable learner data. Specify retention, device-boundary disclosure, account linking, rate-limit failure UX, and deletion behavior before release.

Write review event and derived progress state atomically. Require idempotency keys for retryable submissions. Add migrations with rollback notes, least-privilege grants, RLS tests for cross-learner isolation, and a verification against deployed infrastructure.

### 12. Replace temporary adapters safely

Migrate in stages: fixture vertical slice, production read path, then production write path. Keep the temporary adapter explicit and test-only. Do not claim MVP persistence until a review survives reload and process restart under actual authorization rules.

Measure payload size and request count with realistic corpus size. Move repetitive aggregation into an RLS-safe query/view when network round trips, not database compute, dominate latency.

### 13. Run beta-quality gates

Run content validation, domain tests, migration/RLS tests, application build and typecheck, core E2E flow, accessibility checks at mobile and keyboard targets, and realistic performance checks. Run framework build before generated-type validation when framework output supplies types.

Separate code-owned checks from admin-owned controls such as branch protection, OAuth credentials, storage backup location, and scheduled retention jobs. Record owner and evidence; never mark external controls complete from repository files alone.

## Delivery gates

| Gate | Required proof | Next action |
| --- | --- | --- |
| Product direction | MVP, learner, non-goals accepted | Prototype brief |
| Prototype | Primary flows and states inspected | PRD |
| Build readiness | PRD, architecture, design system, decisions aligned | Repository scaffold |
| Implementation authorization | User explicitly asks to code | Create vertical slice plan |
| Slice viability | Published content, real identity boundary, transactional write, reload persistence | Extend learner loop |
| Beta readiness | CI, RLS, content/asset QA, E2E, accessibility, performance, rollback/backup evidence | Beta approval |
| Release readiness | Tests, review, migration plan, operational checks | Deploy using approved process |

## Outputs

Return concise status with created/updated artifacts, decision/assumption changes, completed requirement IDs, validation evidence, known temporary seams, external-owner items, and remaining approval needed. Link files by path where supported.
