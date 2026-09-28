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

A complete committed-HEAD audit previously found 21 failures. QA-001 corrected two stale required-date fixtures (focused validation 12/12; independent review passed). QA-002 repaired three stale Longitudinal/Timeline test contracts (focused validation 107/107; independent review passed with qualifications). The expected remaining baseline is 16: readiness/privacy (6) and UI simplification (10). Full regression has not yet been rerun, so 16 is not a verified complete-suite total.

AOS-003 introduced no failures. Most remaining failures appear to be stale or implementation-coupled assertions, while changed product-contract intent remains unresolved in several cases. Repair belongs in separately scoped tasks. `validate:release` remains red; the application is not release-green.

On September 28, 2026, `npm run validate:build` correctly returned nonzero because Turbopack could not fetch the Inter font from Google Fonts due to a network connection failure. This is an environmental build blocker, not evidence of an AOS-003 application-code regression; because the build stopped early, it does not prove that later build stages would pass. Rerun the build once in an environment that can reach the required font resource or has it cached. `validate:release` remains red because of both the expected unresolved baseline failures and this build-environment qualification. Neither AOS-003 nor the application is release-green.

## Unrelated working-tree items

Existing unrelated items:

- Modified: `components/app/BottomTabBar.tsx`.
- Modified: `docs/mac-handoff-checklist.md`.
- Untracked: `supabase/.temp/`.

## Active work, blockers, and next priorities

- Phase 1 Agent Operating System: final documentation content audit; no blocker to delivery.
- Follow-up validation gap: Health Command Center browser automation did not complete. A rerun, if required, belongs in a subsequent scoped task.
- Device coverage beyond the confirmed manual keyboard and production visual QA is unspecified. OTP staging/production delivery and provider-behavior checks are not confirmed here.
- Next product implementation priority has not been supplied.
