# Release Runbook

1. Claude confirms task acceptance criteria and review result.
2. CI passes lint, typecheck, unit tests, build, migration check, and E2E smoke.
3. Deploy preview and validate guest learning, progress persistence, and audio flow.
4. Apply migration to staging; verify RLS and rollback note.
5. Promote production deployment.
6. Run production smoke: guest session, Grammar submit, Vocabulary review, Listening signed URL.
7. Monitor error rate, sync failures, and audio playback failures.

Never apply a schema change directly from dashboard UI.
