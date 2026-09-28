# Task packet: QA-001 — Dosing date fixture repair

## Outcome and behavior

- **Business outcome:** Restore focused dosing and phase-lifecycle test coverage at committed HEAD without changing application behavior or dosing semantics.
- **Current behavior:** Two tests call `quickEntryPayload` without its required client-supplied local date and fail with `Invalid date.` before reaching their intended assertions.
- **Desired behavior:** Each test supplies a fixed valid date and continues to verify its original dosing-warning or phase-boundary behavior.
- **Acceptance criteria:**
  - [x] Both stale payload fixtures include a deterministic valid `YYYY-MM-DD` date.
  - [x] Existing assertions remain unchanged and no error is caught or suppressed.
  - [x] The two-file focused validation passes with complete evidence.
  - [x] `git diff --check` passes and repository status confirms only allowed files changed by this task.

## Scope and preservation

- **In scope:** Audit the two failures, correct only their invalid fixtures, document the task, and run the explicitly limited validation.
- **Out of scope:** Application behavior, production input validation, broad regression, TypeScript, build, browser automation, release validation, staging, publication, deployment, and Supabase.
- **Allowed files or surfaces:** `tests/dosing-entry.test.mjs`, `tests/phase-lifecycle.test.mjs`, and `docs/tasks/QA-001-dosing-date-fixtures.md`.
- **Required preservation boundaries:** Preserve all medication-dose, syringe-unit, injection-volume, phase-boundary, lifecycle, and date-validation semantics. Do not edit or include `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, or `supabase/.temp/`.

## Token/work budget

- **Budget:** Unspecified; work is bounded to the named files, directly invoked helpers, nearby fixture evidence, and required documentation.
- **Checkpoint and limit behavior:** Stop if the failures persist with valid dates or evidence indicates an application defect; report rather than edit application code.

## Validation requirements

| Check | Required? | Command/scenario, timing, and evidence |
| --- | --- | --- |
| Focused tests | Yes | `npm run validate:focused -- tests/dosing-entry.test.mjs tests/phase-lifecycle.test.mjs`; both files must pass with complete evidence. |
| Broad regression tests | No | Explicitly excluded by task scope. |
| Browser tests | No | No browser behavior changes; explicitly excluded. |
| TypeScript | No | Test-fixture/documentation-only change; explicitly excluded. |
| Production build | No | No application change; explicitly excluded. |
| Manual QA | No | Deterministic fixture repair is covered by the focused test command. |

Also required: `git diff --check` and `git status --short`.

### Validation result

On September 28, 2026, the focused command passed 12 of 12 tests across both requested files, with 0 failures, 0 skipped, 0 cancelled, and 0 incomplete tests. The SQL-backed dosing test executed successfully.

## Known baseline failures

At committed HEAD, the two scoped failures are `tests/dosing-entry.test.mjs` (mass/IU mismatch and incomplete concentration) and `tests/phase-lifecycle.test.mjs` (last new phase defaults ongoing). Both omit the date required by `quickEntryPayload`; no other baseline failures are in scope.

## Authorization boundaries

| Action | Authorization and scope |
| --- | --- |
| Staging | Not authorized. |
| Commit | Not authorized. |
| Push | Not authorized. |
| Deployment | Not authorized. |
| Supabase | Not authorized. |

## Stop conditions

**Blocked:** If required work cannot proceed within the agreed scope, preservation boundaries, available evidence/access, or authorization, stop the dependent action and report the blocker, unfinished acceptance criteria, and exact input or decision needed. Continue only unaffected authorized work; do not claim completion.

**Task-specific triggers:** Stop without editing application code if either failure remains after supplying a fixed valid date, if the validator rejects a calendar-valid `YYYY-MM-DD` value, or if the repair would require weakening an assertion or changing dosing or lifecycle semantics.

## Expected final report

Report each root cause and exact fixture correction, assertion preservation, changed files, focused test totals, diff-check result, qualifications, and confirmation that application code and preserved unrelated work were untouched.
