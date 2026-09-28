# Project state

Last updated: 2026-09-28.

Maintain this as a current snapshot: replace stale entries when verified, remove resolved blockers, and do not append a running history. Mark reported facts separately from verified facts.

## Production

- Current behavior-changing production baseline: `9e03e28` — `feat: add executive Health command center (MPP-016)` — deployed and visually verified by Rafael on September 28, 2026.
- Agent Operating System foundation: `1fb846a` — `docs: add agent operating system foundation`.
- Documentation-only commits may be newer than the application baseline without changing production behavior. Do not update PROJECT_STATE.md solely to chase the latest documentation-only commit SHA.
- Protocol-ring correction `9d2af8e` was deployed and passed production QA. Both deployment statements are owner-confirmed; this documentation audit did not inspect production.
- Major capabilities reported in README and MPP-015/015A/016: protocol creation and management, scheduling and inventory; Today actions/check-ins and persistent protocol rings; guided first-protocol setup; unified email OTP signup/login; Health Command Center, labs/imports, longitudinal views, Timeline, AI Health Analyst, and doctor-ready reports.
- Health Command Center browser automation timed out; manual keyboard QA and production visual QA passed, as confirmed by the owner. The timeout is not a passing browser-automation result.
- Actual deployed OTP templates/settings remain unverified in this documentation audit.

## Known baseline failures

No known baseline test failure remains in the final QA-004 validation. Focused validation ran 2 files and 61 tests: 61 passed, 0 failed, 0 skipped, 0 cancelled, and 0 incomplete. `validate:types` passed. Full regression discovered 54 files and ran 1,383 tests: 1,383 passed, 0 failed, 0 skipped, 0 cancelled, and 0 incomplete. `validate:build` passed.

The final regression blocker was corrected by changing the consumer-facing label from `Reported status` to `Lab status`. `tests/personal-baseline.test.mjs` was not modified to bypass the contract. Manual QA previously passed for the QA-004 scope. QA-004 is ready for staging and commit; neither action has been performed.

## Unrelated working-tree items

Existing unrelated items:

- Modified: `components/app/BottomTabBar.tsx`.
- Modified: `docs/mac-handoff-checklist.md`.
- Untracked: `supabase/.temp/`.

## Active work, blockers, and next priorities

- Phase 1 Agent Operating System: final documentation content audit; no blocker to delivery.
- Follow-up validation gap: Health Command Center browser automation did not complete. A rerun, if required, belongs in a subsequent scoped task.
- Device coverage beyond the confirmed manual keyboard and production visual QA is unspecified. OTP staging/production delivery and provider-behavior checks are not confirmed here.
- QA-003 accepts `/demo` redirecting to `/` as the temporary retired-demo contract; rebuilding a fictional demo remains future work. Privacy mailbox operation and native/TestFlight/App Store operational checks remain unverified.
- QA-004 UI simplification contract repairs have passed focused, type, full-regression, build, and prior manual QA gates and are ready for staging and commit.
- Next product implementation priority has not been supplied.
