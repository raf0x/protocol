# QA-002 — Timeline test contracts

## Outcome and behavior

- **Business outcome:** Restore the three committed-HEAD Longitudinal and Timeline tests while preserving application behavior.
- **Current behavior:** Longitudinal has three native History updates for all treatments, a specific treatment, and a change refinement. Timeline has five event-category buttons plus treatment chips. The baseline includes active protocols only when their start date is present and no later than today.
- **Desired behavior:** Tests assert these contracts without relying on stale aggregate counts or dereferencing excluded protocols.
- **Acceptance criteria:**
  - [x] Longitudinal checks all URL update paths, list-only pagination reset, persistent selector and periods, and Overview, Analyst, and changes navigation.
  - [x] Timeline UI checks five named category buttons separately from named treatment chips, with native button semantics and selected state.
  - [x] Timeline baseline checks current dosing, expired and overlapping phase omission, and complete exclusion of undated or future protocols.
  - [x] No application code, unrelated work, or test names changed.

## Scope and preservation

- **In scope:** The three failing tests and this task packet.
- **Out of scope:** Product behavior changes, application code, release work, and repository-wide audit.
- **Allowed files:** `tests/longitudinal.test.mjs`, `tests/timeline-ui.test.mjs`, `tests/timeline.test.ts`, and this file.
- **Preserve:** Owner scoping, treatment identity and filtering, URL state, pagination, normalization, and the existing changes in `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, and `supabase/.temp/`.

## Token/work budget

- **Budget:** Unspecified; bounded to the requested files and checks.
- **Checkpoint:** Report any ambiguous product intent or application defect before changing its test.

## Validation requirements

| Check | Required? | Evidence |
| --- | --- | --- |
| Focused tests | Yes | `npm run validate:focused -- tests/longitudinal.test.mjs tests/timeline-ui.test.mjs tests/timeline.test.ts` |
| Git diff check and status | Yes | `git diff --check`; `git status --short` |
| Broad regression | No | Excluded by task-specific limit. |
| Browser tests | No | Excluded by task-specific limit. |
| TypeScript | No | Excluded by task-specific limit. |
| Production build | No | Excluded by task-specific limit. |
| Manual QA | No | Test-contract repair only; application behavior is unchanged. |

## Known baseline failures

- At committed HEAD `cd84861`, the three named tests fail due to the stale History occurrence count, the combined category/chip button count, and a future-protocol dereference. Focused validation below determines the corrected result.

## Focused result

- QA-002 repaired three stale Longitudinal/Timeline test contracts. Longitudinal tests invoke production control handlers and inspect the resulting History URLs. Timeline filters are checked through React element roles and accessible names. The baseline test explicitly verifies absent future/undated records and valid current dosing.
- `npm run validate:focused -- tests/longitudinal.test.mjs tests/timeline-ui.test.mjs tests/timeline.test.ts`: 107 passed, 0 failed, 0 skipped.
- Independent review passed with qualifications: some pagination, persistence, and navigation checks remain source-coupled. Unit harnesses do not prove browser focus, React reconciliation, computed CSS visibility, or the complete browser accessible-name algorithm.
- Product decision: none unresolved; the inspected implementation and nearby passing tests support the corrected contracts.

## Authorization boundaries

| Action | Authorization and scope |
| --- | --- |
| Staging | Not authorized. |
| Commit | Not authorized. |
| Push | Not authorized. |
| Deployment | Not authorized. |
| Supabase | Not authorized. |

## Stop conditions

- Stop test correction if observed behavior is defective or product intent is ambiguous; report evidence and the decision needed.
- Do not expand validation beyond the commands above.

## Expected final report

Report each root cause and assertion correction, coverage, changed files, focused totals, diff-check, unresolved decisions, and preservation of application code and unrelated files.
