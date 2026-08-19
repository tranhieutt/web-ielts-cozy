# Project Structure

```text
index.html                Full interactive Design Code mockup runtime, deployed by Vercel
assets/dc-runtime.js      Design Code runtime for mockup interactions
assets/images/            Runtime copies of approved visual assets
apps/web/                 Next.js application and BFF API
packages/ui/              Shared design-system primitives
packages/contracts/       Shared types and validation schemas
packages/content-engine/  Scoring, spaced repetition, recommendations
packages/config/          Tooling configuration
supabase/                 Migrations, seed data, server functions
content/                  Source-controlled learning content metadata
design-tokens.json        Canonical machine-readable Design Tokens
DESIGN.md                 Canonical Design System rules
references/               Immutable mockup and source assets; never runtime code
docs/                     Product, architecture, ADRs, contracts, runbooks
.agents/                  Shared agent context, workflows, templates, checks
```

## Feature-module contract

Each feature lives in `apps/web/src/features/<feature>/` and may contain:

```text
components/    Feature-owned UI
actions.ts     Server Actions
service.ts     Business behavior
repository.ts  Database access adapter
schema.ts      Validation contract
types.ts       Local feature types
tests/         Feature tests
README.md      Intent, invariants, dependencies
```

Shared code belongs in `packages/` only after two or more features use it. Do not create generic abstractions speculatively.

## Content rules

`content/` stores human-reviewable metadata and validation fixtures, not licensed audio binaries. Audio binaries live in managed storage. Every published item needs source and license metadata.
