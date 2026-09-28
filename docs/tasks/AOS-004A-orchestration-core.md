# Task packet: AOS-004A - Deterministic orchestration core

**Final disposition:** **BLOCKED.** The same independent Astra reviewer completed the final recheck after correction round 2. R3 transaction recovery, N1 temp ownership, and every other reviewed finding were resolved except R6 authoritative READY/artifact consistency and R7 restart-safe correction dispatch. AOS-004A exhausted its two correction rounds and is closed without completion or release approval. Rafael explicitly authorized bounded successor [AOS-004A2](AOS-004A2-orchestration-integrity-closure.md) for R6 and R7 only.

## Outcome and behavior

- **Business outcome:** Prove the Agent Operating System orchestration contract deterministically before authorizing any live agent runtime.
- **Current behavior:** The repository has an Agent OS workflow and validation harness but no executable coordinator for task routing, candidate identity, evidence freshness, correction limits, or resumable run state.
- **Desired behavior:** A small local coordinator uses fake scripted agents and validation, treats their responses as untrusted proposals, and stops only at an unstaged verified handoff or an explicit blocked/cancelled state.
- **Historical local implementation evidence (final task disposition is BLOCKED):**
  - [x] Low, medium, and high risk route to the exact required roles; higher semantic risk blocks for packet amendment.
  - [x] Two concurrent agents, three total identities, and two correction/recheck rounds are the hard limits.
  - [x] Corrections and rechecks retain the original implementer and reviewer identities; reviewers cannot mutate candidates.
  - [x] The complete proposed mutation is path-checked before application, including traversal, absolute paths, Git metadata, Windows aliases, unauthorized rename/delete, and detectable link escape.
  - [x] Candidate identity derives from the approved base commit and sorted operation/path/content manifest; changed candidates invalidate candidate-bound evidence.
  - [x] Missing, malformed, stale, mismatched, timed-out, cancelled, skipped, or failed required evidence cannot produce readiness.
  - [x] Human QA cannot be replaced by an agent assertion, and `not_required` requires an approved packet reason.
  - [x] Atomic local state preserves the packet hash, identities, counters, candidate, and evidence across resume and detects workspace drift.
  - [x] All completed or blocked runs write the five JSON Schema 2020-12 artifacts.
  - [x] The disposable wording-only fixture reaches `READY_FOR_HANDOFF` with one changed file, no staged paths, and no remote.
  - [x] Stage, commit, push, deploy, and Supabase are represented as `outside_v1`; no release executor or live agent integration exists.

## Architecture boundary

The implementation lives under `tools/agent-orchestrator/` and uses Node built-ins. `coordinator.mjs` owns the state machine and authoritative artifacts; `policy.mjs` owns risk, limits, and path rules; `workspace.mjs` owns proposal validation, mutation, drift checks, and candidate hashing; `agents.mjs` and `validation.mjs` provide deterministic fake adapters; `evidence.mjs` validates and writes closed artifacts. The run-state and artifact directories are separate, and fixture trials use an operating-system temporary workspace rather than the canonical checkout.

This is policy enforcement for a deterministic local proof, not a security sandbox. Fake adapter outputs remain untrusted data. There is no web UI, database, queue, distributed worker, multi-task scheduler, dynamic model selection, recursive delegation, live Codex session, or release capability.

## Independent-review correction round 1

The correction is limited to the eleven blocking findings and one cleanup finding from the independent review:

1. Delete and rename authority now comes only from the approved packet's high-risk mutation policy; an agent's `authorized` field has no authority.
2. Candidate writes use exclusive random files under a uniquely created coordinator-owned workspace directory and never use neighboring target-name temp files.
3. V1 accepts regular-file add/modify/delete/rename only. Directory targets, duplicate targets, ancestor/descendant conflicts, missing parents, and invalid later operations fail before mutation.
4. A legal-transition table makes `READY_FOR_HANDOFF`, `BLOCKED`, and `CANCELLED` absorbing during automatic execution. Await continuations re-check terminal state and integrity before accepting evidence or mutating.
5. Intake pins task HEAD, index, byte-level workspace state, and optional canonical HEAD/index/worktree/preservation fingerprints. Mutation, validation, handoff, and READY resume all revalidate them.
6. Resume recomputes packet/risk/candidate invariants and checks identities, concurrency, corrections, evidence, human QA, validation, readiness, and cross-artifact semantics instead of trusting persisted phase.
7. Correction attempts persist a stable attempt id, round, ordinal, identity, adapter-request count, response, and `reserved`/`dispatched`/`responded`/`completed` status. The fake adapter is idempotent by attempt id; logical calls and physical adapter requests are separately recorded.
8. Human product-QA evidence is bound to task, run, packet, current candidate, human producer, result, and evidence reference; candidate-changing corrections invalidate it and return to product QA.
9. Nested fake-agent outputs are structurally validated before use. READY artifacts are schema/cross-artifact validated and durably written before READY is persisted; failure persists BLOCKED.
10. Candidate manifests hash exact filesystem bytes and deterministic add/modify/delete/rename semantics rather than decoded text or proposed content.
11. Every `.git` path component is rejected case-insensitively after slash normalization, including nested and backslash variants.

Synthetic-trial cleanup now uses exception-safe cleanup while retaining explicit `--keep` debug mode.

## Independent-review correction round 2

Astra's correction-round-1 recheck left four areas open; this final permitted correction round is limited to them:

1. **R3 - transaction recovery:** apply, readback, resulting-byte hashing, and manifest finalization now share one recovery boundary. Exact pre-mutation bytes/type/existence are restored and verified for every affected path. Complete and incomplete recovery are recorded explicitly, rollback errors are retained, and no candidate manifest is published after transaction failure.
2. **R6 - readiness semantics:** READY and READY resume validate required packet checks, evidence freshness/completeness, role identities, architecture/review/implementation/test/QA results, non-negative counters and limits, candidate binding, and cross-artifact semantic agreement. Schema-valid contradictions fail closed.
3. **R7 - correction idempotency/accounting:** each correction has one durable attempt id and logical reservation before dispatch. Adapter requests are counted separately; a response is durably persisted before application; uncertain retries recover the fake adapter's cached response by attempt id without creating a second logical call.
4. **N1 - temp ownership:** each transaction uses an exclusive `mkdtemp` directory plus an ownership token. Cleanup occurs only after verified acquisition and identity/token checks. Preexisting or racing third-party paths are never recursively removed, while explicit keep/debug mode retains the owned directory.

Hostile focused tests exercise mid-second-operation failure, readback failure, manifest-finalization failure, restore failure, recovery-verification failure, byte-identical successful restoration, contradictory READY evidence/artifacts, every correction crash boundary, physical versus logical invocation counts, exhausted budgets, competing temp creation, cleanup, and keep behavior.

## Scope and preservation

- **Allowed implementation surface:** `tools/agent-orchestrator/**`, `tests/agent-orchestrator.test.mjs`, this task packet, and `docs/agent-os/PROJECT_STATE.md`.
- **Preserve:** All application behavior and files; the canonical Git index; `components/app/BottomTabBar.tsx`; `docs/mac-handoff-checklist.md`; `supabase/.temp/`; all credentials, remotes, production data, and Supabase state.
- **Fixture restriction:** The trial has one exact allowed file (`README.md`), no application code, production data, credentials, or remote. Independent review is explicitly required despite low risk. Focused validation is required; build, browser, and product QA are explicitly not required because the candidate is synthetic and nonfunctional.
- **Authorization:** Staging, commit, push, deployment, Vercel, and Supabase actions are not authorized.

## Token/work budget

- **Budget:** Unspecified by the owner. Runtime enforcement supports a packet-level maximum agent-call count when supplied.
- **Limit behavior:** Any identity, concurrency, correction, or supplied call-budget exhaustion blocks the run and still emits authoritative artifacts.

## Validation requirements

| Check | Required? | Command/scenario, timing, and evidence |
| --- | --- | --- |
| Focused tests | Yes | `npm run validate:focused -- tests/agent-orchestrator.test.mjs`; covers the state machine, hostile inputs, artifacts, resume, trial, and preservation. |
| TypeScript | Yes | `npm run validate:types`; confirms the existing typed application remains valid. |
| Broad regression | No | Deferred to Delivery Lead final release validation after independent review. |
| Production build | No | Deferred to Delivery Lead final release validation after independent review. |
| Browser tests | No | No browser or application behavior is introduced. |
| Product QA | No | The implementation is developer tooling; the synthetic trial is nonfunctional and records the approved reason. |
| Git whitespace | Yes | `git diff --check`; no staging is needed or authorized. |

### Correction-round-1 evidence

- `npm run validate:focused -- tests/agent-orchestrator.test.mjs`: PASS - 1 file, 38 tests, 38 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo.
- `npm run validate:types`: PASS.
- Independent round-1 re-review: **CHANGES REQUIRED**; correction round 2 followed under the original task budget.

### Correction-round-2 evidence

- `npm run validate:focused -- tests/agent-orchestrator.test.mjs`: PASS - 1 file, 44 tests, 44 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo.
- `npm run validate:types`: PASS.
- `git diff --check`: PASS.
- Independent Astra final recheck: **CHANGES REQUIRED** for R6 and R7 only. AOS-004A stopped **BLOCKED** after exhausting its correction budget.

## Deferred AOS-004B work

AOS-004B may connect a live agent runtime only under separate authorization and a new architecture/review task. It must define the runtime trust boundary, process supervision, credentials, permissions, cancellation, and operational evidence without treating prompt instructions as security isolation. This task neither implements nor authorizes that work.

## Stop conditions

Runs fail closed with the approved reason taxonomy for scope expansion, unauthorized path, risk mismatch, missing product decision or evidence, review limit, validation failure, absent release authorization, destructive/production mutation, exhausted budget, runtime failure, integrity failure, or workspace drift. A blocked condition is never converted to success.

## Expected handoff

Return acceptance outcome, changed files, implemented architecture, exact focused/type/diff results, safe-trial result, preservation evidence, remaining gaps, and independent-review focus. Do not stage, commit, push, deploy, or mutate Supabase.
