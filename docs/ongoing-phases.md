# Ongoing latest phases

New editor phases (including Add phase), quick-create phases, and newly seeded active demo records now default to an empty duration / `end_week=NULL`. The older quick-create payload helper uses the same default. Dosing conversion functions are unchanged. Existing bounded phases are loaded with their saved duration; opening the editor never clears an old end date. The latest phase of an active protocol has an explicit Set ongoing shortcut that clears the duration in the draft; Save commits that choice.

`phaseEndWeek` maps blank duration to NULL and a positive explicit duration to an inclusive end week. `currentPhase` is unchanged and still returns no phase outside saved ranges. Timeline normalization and behavior are untouched.

When the dashboard has no current phase and the unique latest phase has expired, it shows “Your latest dose phase ended. Continue it as ongoing or add a new phase.” Continue latest phase calls an authenticated RPC and refreshes on success. Add new phase opens the compound editor with a new ongoing draft starting after the recorded phase boundaries; it does not save anything automatically. A phase with an explicit duration remains bounded. If replacing an already ongoing phase with a later phase, first explicitly bound the earlier phase; this release does not automatically rewrite previous phases.

## Migration

Apply `202609110001_continue_latest_phase.sql` after existing migrations and before deploying this UI. It creates only the `continue_latest_phase` function and its execute grant. No columns, triggers, constraints, or historical values are modified by migration application. Invocation verifies authentication, protocol ownership and active status, compound ownership, selected phase ID, and that it is the unique latest non-overlapping phase. It locks the protocol and compound consistently with the save RPC. Only the selected phase's `end_week` and corresponding `duration_weeks` are set to NULL. Medication, raw dosing entry, start week, schedule, other phases, and completed protocols are preserved. Repeated invocation is safe. Nothing is applied to production by this delivery.

## Files changed

- `app/protocol/manage/page.tsx`: ongoing defaults, inclusive end-week helper, latest-phase shortcut and add-phase deep link.
- `lib/health/phaseLifecycle.ts`: strict expired-latest detection and duration-to-end-week calculation.
- `components/dashboard/HeroProtocolCard.tsx`: expired-phase message, explicit continuation and new-phase actions, error/loading handling.
- `app/protocol/page.tsx`: include phase IDs for targeted actions; newly seeded active phases have no default expiry.
- `lib/health/dosingEntry.ts`, `lib/health/dosing.ts`: quick-create phase default only, no dosing conversion changes.
- `supabase/migrations/202609110001_continue_latest_phase.sql`: narrow authenticated continuation RPC.
- `tests/phase-lifecycle.test.mjs`: ongoing/expired/completed/multiphase and duration defaults.
- `tests/dosing-entry.test.mjs`: SQL continuation, exact row comparison, prior-phase preservation, completed-protocol rejection and cross-user denial.
- `docs/ongoing-phases.md`: rollout and behavior report.

## Validation

43 phase, dosing, Timeline and database tests passed. Database tests use disposable PGlite, apply the migration twice, and verify only end boundary/duration change on continuation. TypeScript and production build passed. Build uses disposable Supabase/VAPID configuration and the environment's system TLS certificates for the existing Google Fonts request. No live production browser or database was accessed.
