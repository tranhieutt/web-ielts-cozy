---
name: edtech-software-development
description: Guide a B2C EdTech product from idea through Claude Design prototype, PRD, architecture, design system, agentic repository scaffold, and initial Git setup. Use for new learning-product discovery, planning, or zero-to-foundation delivery before implementation.
---

# EdTech Software Development

## Purpose

Use this workflow to turn an EdTech idea into approved, traceable product foundation. Keep planning, design, architecture, repository setup, and Git separate from application implementation.

Read `references/edtech-product-playbook.md` before beginning. Use existing repository documents as source of truth when present.

## Operating rules

- Confirm product scope, learner, platform, content source, scale, and monetization before choosing architecture.
- State assumptions. Ask only questions that materially alter product direction.
- Treat prototype as visual and interaction evidence; never treat it as production source code.
- Do not start application implementation unless user explicitly authorizes it.
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

## Delivery gates

| Gate | Required proof | Next action |
| --- | --- | --- |
| Product direction | MVP, learner, non-goals accepted | Prototype brief |
| Prototype | Primary flows and states inspected | PRD |
| Build readiness | PRD, architecture, design system, decisions aligned | Repository scaffold |
| Implementation authorization | User explicitly asks to code | Create vertical slice plan |
| Release readiness | Tests, review, migration plan, operational checks | Deploy using approved process |

## Outputs

Return concise status with created/updated artifacts, decisions, assumptions, validation performed, and remaining approval needed. Link files by path where supported.

