# Project state

Last updated: 2026-09-28.

Maintain this as a current snapshot: replace stale entries when verified, remove resolved blockers, and do not append a running history. Mark reported facts separately from verified facts.

## Production

- Current production main: `f133336` — `fix: repair UI simplification contracts (QA-004)` — committed, pushed, and successfully deployed through Vercel, as confirmed by Rafael on September 28, 2026.
- Agent Operating System foundation: `1fb846a` — `docs: add agent operating system foundation`.
- Documentation-only commits may be newer than the application baseline without changing production behavior. Do not update PROJECT_STATE.md solely to chase the latest documentation-only commit SHA.
- Protocol-ring correction `9d2af8e` was deployed and passed production QA. Both deployment statements are owner-confirmed; this documentation audit did not inspect production.
- Major capabilities reported in README and MPP-015/015A/016: protocol creation and management, scheduling and inventory; Today actions/check-ins and persistent protocol rings; guided first-protocol setup; unified email OTP signup/login; Health Command Center, labs/imports, longitudinal views, Timeline, AI Health Analyst, and doctor-ready reports.
- Health Command Center browser automation timed out; manual keyboard QA and production visual QA passed, as confirmed by the owner. The timeout is not a passing browser-automation result.
- Actual deployed OTP templates/settings remain unverified in this documentation audit.

## Known baseline failures

No known baseline test failure remains in the recorded AOS-004A2 release-gate validation. `validate:focused` passed 1 file and 48 tests: 48 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo. `validate:types` passed. `validate:regression` passed 1,431 tests: 1,431 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo. `validate:build` passed. These results are recorded from Rafael's verified closeout report; this documentation update did not rerun them.

## Unrelated working-tree items

Existing unrelated items:

- Modified: `components/app/BottomTabBar.tsx`.
- Modified: `docs/mac-handoff-checklist.md`.
- Untracked: `supabase/.temp/`.

## Active work, blockers, and next priorities

- AOS-004A stopped **BLOCKED** after exhausting two correction rounds. Rafael explicitly authorized AOS-004A2 as the bounded successor; it closed the remaining R6 and R7 blockers. Independent Astra review returned **PASS WITH QUALIFICATIONS**, no blocking findings, and **CLEAR FOR RELEASE GATE**. The qualification concerns wording precision in the existing crash-boundary test title, not function. Focused, type, full-regression, and build checks passed; AOS-004A2 is ready for staging and commit. `READY_FOR_HANDOFF` remains an unstaged handoff only. AOS-004A/A2 introduced no live AI runtime or release executor and performed no staging, commit, push, deployment, Vercel mutation, or Supabase mutation. AOS-004B live-runtime integration remains deferred and unauthorized.
- Follow-up validation gap: Health Command Center browser automation did not complete. A rerun, if required, belongs in a subsequent scoped task.
- Device coverage beyond the confirmed manual keyboard and production visual QA is unspecified. OTP staging/production delivery and provider-behavior checks are not confirmed here.
- QA-003 accepts `/demo` redirecting to `/` as the temporary retired-demo contract; rebuilding a fictional demo remains future work. Privacy mailbox operation and native/TestFlight/App Store operational checks remain unverified.
- Next product implementation priority has not been supplied.
