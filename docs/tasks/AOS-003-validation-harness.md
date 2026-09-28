# Task packet: AOS-003 — Minimal validation harness

## Outcome and behavior

- **Outcome:** Provide one deterministic local orchestrator for focused, release, browser, and staged-file validation without changing application behavior.
- **Acceptance criteria:** The seven documented npm commands validate explicit inputs, supply PGlite to focused and regression SQL tests, fail closed on skipped or incomplete test evidence, supervise and clean the complete owned browser process tree after every outcome, run both Git whitespace checks, and never stage or mutate repository files.

## Scope and preservation

- **Approved files:** `scripts/validate.mjs`, `tests/validation-harness.test.mjs`, this task packet, `package.json`, `package-lock.json`, `docs/agent-os/WORKFLOW.md`, and `docs/agent-os/TASK_TEMPLATE.md`.
- **Preserve:** Application source/tests and browser fixtures; `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, and `supabase/.temp/`; all Supabase state.
- **Excluded:** Browser automation is available separately but is not part of the release gate.

## Validation plan

- **Implementation gate:** `node --test tests/validation-harness.test.mjs`, the same file through `validate:focused`, `git diff --check`, and `git status --short` only.
- **Release gate:** TypeScript, standard regression, production build, then exact staged-file validation. `validate:release` remains red while the recorded baseline failures remain unresolved.

## Regression baseline audit

The complete committed-HEAD audit found 53 standard files and 1,355 tests: 1,334 passed, 21 failed, 0 skipped, 0 cancelled, and 0 incomplete. All nine PGlite-dependent files executed. The failures reproduce on committed HEAD, so AOS-003 introduced no failures. The harness adds one file and 23 passing tests, producing 54 files and 1,378 tests: 1,357 passed and the same 21 failed.

- **Readiness/privacy (6):** `app-store-readiness.test.mjs:122,145,161,170,190`; `launch-blockers.test.mjs:72`.
- **Dosing/date fixtures (2):** `dosing-entry.test.mjs:34`; `phase-lifecycle.test.mjs:25`.
- **Longitudinal/Timeline (3):** `longitudinal.test.mjs:378`; `timeline-ui.test.mjs:67`; `timeline.test.ts:115`.
- **UI simplification (10):** `ui-simplification.test.mjs:47,87,92,127,136,144,193,199,216,223`.

Most appear to be stale or implementation-coupled assertions. Changed product-contract intent remains unresolved in several cases, so repairs require separately scoped tasks. The application must not be described as release-green until those failures are resolved.

## Build qualification

On September 28, 2026, `npm run validate:build` correctly returned nonzero because Turbopack could not fetch the Inter font from Google Fonts due to a network connection failure. This is an environmental build blocker, not evidence of an AOS-003 application-code regression; because the build stopped early, it does not prove that later build stages would pass. Rerun the build once in an environment that can reach the required font resource or has it cached. `validate:release` remains red because of both the 21 committed-HEAD test failures and this unresolved build-environment qualification. Neither AOS-003 nor the application is release-green.

## Authorization boundaries

No staging, commit, push, deployment, or Supabase action is authorized.
