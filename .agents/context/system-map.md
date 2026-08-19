# System Map

For the complete file/module map, read `docs/architecture/CODEMAP.md`.

```text
Guest browser → Next.js → feature service → Supabase
                                      ├─ Postgres: progress/content metadata
                                      ├─ Auth: anonymous or registered session
                                      └─ Storage: Listening audio
```

Primary learner path: guest session → choose Vocabulary/Grammar/Listening → submit/review → persist progress → optional account registration.
