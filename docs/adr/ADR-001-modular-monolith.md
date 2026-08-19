# ADR-001: Modular Monolith with Managed Services

## Context

IELTS Cozy MVP serves about 1,000 B2C monthly active learners. It needs persistent guest progress, Vocabulary, Grammar, Listening audio, and privacy controls for minors. Team capacity is small.

## Decision

Use Next.js as full-stack modular monolith, deployed on Vercel. Use Supabase Auth, Postgres, and Storage. Organize code by feature domain and use shared contracts rather than networked microservices.

## Alternatives considered

- Cloudflare Workers, D1, and R2: efficient audio delivery but more edge/runtime complexity for relational progress and content workflows.
- Separate NestJS/Fastify API, PostgreSQL, and S3-compatible storage: more control but unnecessary DevOps work at MVP scale.

## Consequences

Fast delivery and low operational load. Architecture can extract services later when AI scoring, payments, or high audio egress make it necessary. Supabase/Vercel coupling must be tracked.

## Rollback / migration path

Keep domain services and contracts provider-neutral. Postgres can move to managed PostgreSQL; Storage adapter can move audio to an S3-compatible provider without changing feature APIs.
