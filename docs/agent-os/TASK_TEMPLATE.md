# Task packet: <ID> — <Title>

Replace placeholders with task-specific facts; shared operating rules live in root AGENTS.md.

## Outcome and behavior

- **Business outcome:** <User/business value and success measure.>
- **Current behavior:** <Observed behavior and evidence; distinguish unknowns.>
- **Desired behavior:** <Concrete change, including relevant failure/empty states.>
- **Acceptance criteria:**
  - [ ] <Observable, verifiable result.>
  - [ ] <Relevant boundary or failure case.>

## Scope and preservation

- **In scope:** <Exact work; identify diagnose-only or implementation.>
- **Out of scope:** <Explicit exclusions.>
- **Allowed files or surfaces:** <Exact paths/surfaces.>
- **Required preservation boundaries:** <Existing user changes, data, behavior, APIs, and decisions to preserve.>

## Token/work budget

- **Budget:** <Owner-specified token limit, timebox, or bounded work units; otherwise unspecified.>
- **Checkpoint and limit behavior:** <When to report progress; at a hard limit, hand off completed work and outstanding acceptance criteria without claiming completion.>

## Validation requirements

Mark each check Required or Not required with a reason; do not leave applicability implicit.

| Check | Required? | Command/scenario, timing, and evidence |
| --- | --- | --- |
| Focused tests | <Yes/No; reason> | <Acceptance criteria covered.> |
| Broad regression tests | <Yes/No; reason> | <Suite and release gate.> |
| Browser tests | <Yes/No; reason> | <Flows and environment.> |
| TypeScript | <Yes/No; reason> | <Command and release gate.> |
| Production build | <Yes/No; reason> | <Command and release gate.> |
| Manual QA | <Yes/No; reason> | <Scenarios, devices, accessibility, and verifier.> |

## Known baseline failures

<List only relevant failures with evidence/reference and comparison method, or state none known. Record new failures separately in results.>

## Authorization boundaries

Record task-specific permission below; unfilled entries mean **not authorized**.

| Action | Authorization and scope |
| --- | --- |
| Staging | <Not authorized / exact approved files or hunks.> |
| Commit | <Not authorized / approved change set.> |
| Push | <Not authorized / approved remote and branch.> |
| Deployment | <Not authorized / approved environment and release.> |
| Supabase | <Not authorized / approved project, operation, and data/schema/auth scope.> |

## Stop conditions

**Blocked:** If required work cannot proceed within the agreed scope, preservation boundaries, available evidence/access, or authorization, stop the dependent action and report the blocker, unfinished acceptance criteria, and exact input or decision needed. Continue only unaffected authorized work; do not claim completion.

**Task-specific triggers:** <Concrete conditions requiring a stop or owner decision.>

## Expected final report

<Report outcome against acceptance criteria, files changed and purpose, validation results with baseline failures separated, manual QA gaps, unresolved decisions/blockers, and any authorized staging/publication actions actually performed. Keep it concise.>
