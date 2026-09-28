# Task packet: AOS-004A2 â€” Orchestration integrity closure

**Final disposition:** **PASS WITH QUALIFICATIONS; ready for staging and commit.** Independent Astra review resolved R6 and R7 with no blocking findings and recommended **CLEAR FOR RELEASE GATE**. The qualification concerns wording precision in the existing crash-boundary test title; it is not a functional blocker. AOS-004A stopped **BLOCKED** after exhausting two correction rounds, and Rafael explicitly authorized AOS-004A2 as its bounded successor.

## Outcome and behavior

- **Business outcome:** Make `READY_FOR_HANDOFF` authoritative across run state and all five artifacts, and make correction recovery safe across a fresh coordinator/adapter process.
- **Current defect:** AOS-004A final review showed that mutually consistent artifacts could omit authoritative evidence, release readiness could contradict authoritative status, and an uncertain correction dispatch could execute again after adapter-memory loss.
- **Desired behavior:** One state-plus-artifact semantic boundary guards finalization, READY resume, and explicit artifact validation. Correction calls reserve logical budget durably before dispatch and block uncertain restart recovery rather than replaying.
- **Acceptance criteria:**
  - [x] Empty, unknown, wrong-producer, missing-plan, stale-identity, and contradictory READY artifact evidence fails closed.
  - [x] READY and blocked release results/status/flags must match authoritative state.
  - [x] Approved roles, checks, architecture, review, human QA, candidates, counters, limits, and identifiers remain authoritative.
  - [x] Fresh-adapter restart is covered before reservation, after reservation, after dispatch marking, after adapter execution, after response persistence, and after correction completion.
  - [x] A dispatched request without a persisted response becomes `BLOCKED / RUNTIME_FAILURE`; it is never automatically replayed.

## Scope and preservation

- **In scope:** R6 authoritative READY/artifact consistency and R7 restart-safe correction dispatch only.
- **Out of scope:** Reopening resolved AOS-004A findings, application behavior, live AI/Codex runtime integration, distributed exactly-once execution, release execution, deployment, and Supabase.
- **Previously resolved behavior:** R3 transaction recovery, N1 temp ownership, and every other resolved AOS-004A finding must remain unchanged.
- **Allowed files:** Orchestrator coordinator/evidence/agent/schema files if needed, the focused suite, the AOS-004A/AOS-004A2 task packets, and `PROJECT_STATE.md`.
- **Preserve:** The canonical index and unrelated `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, and `supabase/.temp/` work exactly.

## Design

### R6 authoritative semantic boundary

`validateArtifactSetSchema` and `validateArtifactDirectorySchema` provide explicit schema-only checks. `validateArtifactSet` and `validateArtifactDirectory` require authoritative run state for semantic validation. The semantic boundary compares every emitted envelope, evidence reference, producer, report result, approved role/check/QA requirement, candidate, blocker, and release status/flag against authoritative run state. It also compares correction rounds, implementation paths and operations, review findings, correction-attempt accounting, and physical/logical requests for every registered identity. The coordinator calls it before writing prospective READY artifacts, verifies the persisted files with it before READY persistence, and uses the same boundary on READY resume and explicit artifact-directory validation.

### R7 safe uncertain-dispatch block

A correction reservation durably records attempt id, implementer identity, ordinal, correction round, logical call consumption, zero physical requests, and `not_requested` execution state. Dispatch marking is durable before the adapter request. Immediately before the request, the physical counter and `uncertain` execution state are persisted. A validated response is durably stored with `response_persisted` before candidate application.

After a full restart, `reserved` or `dispatched/not_requested` work may proceed because no physical request was recorded. `dispatched/uncertain` work blocks with explicit recovery evidence and `RUNTIME_FAILURE`; it is never sent to a fresh adapter. A `responded/response_persisted` snapshot may still carry the active implementer marker if the process stopped before `finally`; resume accepts this exact state, durably clears the marker, and applies the persisted response without another adapter request. `completed` work uses persisted state. This is the intentionally small V1 safety model, not durable distributed idempotency.

## Review and correction budget

AOS-004A's exhausted correction budget did not carry into this successor. AOS-004A2 received an independent Astra review: **PASS WITH QUALIFICATIONS**, R6 **RESOLVED**, R7 **RESOLVED**, and no blocking findings. AOS-004B live-runtime integration remains deferred and unauthorized.

## Validation requirements

| Check | Required? | Evidence |
| --- | --- | --- |
| Focused tests | Yes | `npm run validate:focused -- tests/agent-orchestrator.test.mjs`; covers R6/R7 plus preserved AOS-004A behavior and safe trial. |
| TypeScript | Yes | `npm run validate:types`. |
| Git whitespace | Yes | `git diff --check`. |
| Full regression | Release gate complete | `npm run validate:regression`: 1,431 tests passed. |
| Production build | Release gate complete | `npm run validate:build`: PASS. |
| Browser/product release execution | No | No application behavior or release executor was introduced. |
| Product QA | No | No application behavior changes. |

## Authorization boundaries

AOS-004A2 is ready for staging and commit; neither action has occurred. This documentation closeout does not authorize staging, commit, push, deployment, Vercel mutation, release execution, or any Supabase action. `READY_FOR_HANDOFF` remains an unstaged handoff only. AOS-004A/A2 introduced no live AI runtime or release executor and performed no staging, commit, push, deployment, Vercel mutation, or Supabase mutation.

## Local evidence

- Correction Round 1 hostile tests cover the mandatory semantic state, schema-only path, correction rounds, implementation paths and operations, review findings, correction-attempt accounting, and registered-identity physical/logical request counts. The crash test restores the exact `responded/response_persisted` pre-`finally` state file and resumes with a fresh adapter.
- `validate:focused` PASS — 1 file, 48 tests, 48 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo.
- `validate:types` PASS.
- `validate:regression` PASS — 1,431 tests, 1,431 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo.
- Production build: `validate:build` PASS.
- Git whitespace: PASS.
- Independent review: **PASS WITH QUALIFICATIONS**; R6 **RESOLVED**, R7 **RESOLVED**, no blocking findings. The qualification is wording precision around the existing crash-boundary test title, not a functional blocker. Reviewer recommendation: **CLEAR FOR RELEASE GATE**.

## Stop conditions and handoff

R6 and R7 are closed by AOS-004A2. Focused, type, full-regression, and build validation passed; independent review has no blocking findings. The remaining step is separately authorized staging and commit of the reviewed local change. AOS-004B live-runtime integration requires its own authorization.
