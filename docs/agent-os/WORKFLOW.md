# Feature delivery workflow

Use this guide for multi-step feature, review, validation, or release work.
It explains who does what and what evidence is needed before moving forward.
[AGENTS.md](../../AGENTS.md) remains the source of shared preservation and authorization rules.

## Roles

Roles describe responsibilities, not permanent model choices. Model selection can change.
One person or agent may cover compatible roles; independent review must remain separate from implementation.

| Role | Responsibility |
| --- | --- |
| Product owner (Rafael) | Defines the business outcome, accepts product behavior, resolves product choices, and authorizes release actions. |
| Delivery Lead | Sets risk level, keeps the task packet and scope clear, coordinates handoffs, and identifies the next decision or blocker. |
| Architect | Reviews the proposed design, data boundaries, risks, and rollback before implementation when required. |
| Implementer | Makes the agreed changes, runs focused checks, and returns evidence and remaining gaps. |
| Independent reviewer | Examines the change against the task and relevant decisions with fresh eyes; reports defects without taking over implementation. |
| Validator | Verifies the agreed checks against the final change and reports what passed, failed, or remains unverified. |

## Choose the risk level

Use the highest applicable level based on the possible effect, not the size of the edit.

| Level | Examples | Required approach |
| --- | --- | --- |
| Low | Documentation, copy, isolated styling, or other non-behavioral changes. | Usually one implementation thread and focused validation. Independent review is optional unless requested. |
| Medium | User-facing features, shared UI, calculations, routing, or meaningful behavior. | Task packet, implementer, independent reviewer, focused tests, TypeScript, build, and appropriate manual QA. |
| High | Authentication, authorization, owner scoping, schema, migrations, destructive operations, medical calculations, privacy, payments, or deployment configuration. | Medium requirements plus architecture review before implementation, separate implementer and reviewer, and explicit rollback and deployment plans. No production mutation without Rafael's explicit permission. |

Record which checks actually apply in the task packet. A task's explicit narrower limits govern;
report any resulting evidence gap rather than silently expanding scope or claiming release readiness.
A release gate is the final check of the intended change before publication, not a check after every edit.

## Standard feature lifecycle

1. **Intake:** Rafael states the outcome. The Delivery Lead identifies risk, scope, preservation boundaries, and missing information.
2. **Task packet:** Use [TASK_TEMPLATE.md](TASK_TEMPLATE.md) to record observable acceptance criteria, allowed surfaces, budget, required checks, and permissions.
3. **Architecture decision when required:** The Architect reviews high-risk work and other changes affecting established design choices. Rafael resolves any product-decision change before implementation; record durable choices in [DECISIONS.md](DECISIONS.md).
4. **Implementation:** The implementer makes the scoped change and runs focused tests. Hand off a concrete result that can be reviewed.
5. **Product-owner QA:** Rafael checks the intended experience against acceptance criteria in a suitable preview or test environment. Record results and gaps; product acceptance does not authorize deployment.
6. **Independent review:** A separate reviewer checks correctness, relevant decisions, safety, and evidence. Low-risk work may skip this step when review was not requested; record that choice.
7. **Correction loop:** Findings return to the original implementer. Rechecks return to the original reviewer. Repeat affected checks and product QA as needed until blocking findings are resolved.
8. **Final validation:** The validator checks the final change at the release gate: required TypeScript, build, broad regression, browser tests, and manual QA. Separate known baseline failures from new regressions and report missing evidence.
9. **Explicit staging:** Once staging is authorized, select only intended files individually under AGENTS.md and inspect what will be included.
10. **Commit:** Commit the reviewed change only with explicit permission; record the commit identifier.
11. **Push/deployment:** Obtain or use existing explicit permission for each action and target. If push triggers deployment, both must be authorized first. Follow the agreed deployment and rollback plans.
12. **Production QA:** Verify the deployed version against agreed scenarios with authorized access/actions. Record pass, fail, or blocked; a failed check invokes the agreed response, not an unapproved production change.
13. **Project-state update:** Update [PROJECT_STATE.md](PROJECT_STATE.md) after a material product, architecture, deployment, blocker, or priority change. Replace stale status and relevant evidence; do not update it merely because an Agent OS documentation commit was created. Close feature threads once deployment, QA disposition, and handoff are recorded.

This sequence does not grant permission for any step. A documentation-only or review-only task
ends at its defined deliverable; later release steps remain pending or not applicable.
If a required step is blocked by scope, access, evidence, or permission, stop that dependent action,
report the exact input needed and unfinished criteria, and complete only unaffected authorized work.

## Thread rules

- Keep one implementation thread per feature and, when review is required, one separate review thread per feature.
- Start with a fresh reviewer who did not implement the feature; retain that reviewer for rechecks.
- Return corrections to the original implementer instead of starting another implementation thread.
- Close feature threads after deployment and its QA/handoff; start fresh threads for unrelated features.
- Give each agent only the task packet, relevant decisions, relevant files, and necessary evidence. Do not copy the entire project history into every thread.
- Create an optional investigator thread only for a clearly isolated unknown, with a specific question and evidence to return; close it after reporting.
- Do not create permanent specialist agents for every folder or technology. Functional roles do not require six agents for every task.

## Work and token efficiency

- Keep task packets concise and read files selectively; no broad repository audit unless authorized.
- Run focused tests during implementation and broad regression only at the release gate.
- Reuse successful expensive checks when no relevant code change has invalidated them; do not repeatedly rerun them without a reason.
- Report counts and exact failures instead of pasting full logs; link detailed evidence when needed.
- Reuse the implementation thread for corrections and the independent reviewer for rechecks.
- Stop when the defined completion evidence is satisfied; do not add speculative improvements.
- Record durable decisions, current status, and task evidence in the appropriate repository documents instead of relying on chat memory.

## Concise output contracts

| Output | Required contents |
| --- | --- |
| Implementer handoff | Outcome against acceptance criteria; changed files and purpose; focused check results; preserved boundaries; remaining gaps and review target. |
| Independent-review verdict | Pass, changes required, or blocked; findings with severity, file/location, impact, and evidence; required fixes or missing evidence. |
| Validation report | Exact version/change checked; required checks and pass/fail/skipped counts; baseline failures separated from regressions; manual/browser coverage and remaining gaps; ready or blocked. |
| Production-QA result | Deployed commit and environment; verifier and date; scenarios and outcomes; defects or limits; accepted, failed, or blocked with the next action. |

A timeout or skipped check is unverified evidence, never a pass.

## Long-running Codex Goals

Use a Goal only when explicitly requested for a bounded investigation or multi-step work with
a measurable finish line. Do not use one for one-line edits, simple reviews, or vague improvements.
Before starting, name the outcome, completion evidence, constraints (including any supplied budget
and authorization limits), and blocked stop condition: what missing input, access, or decision
prevents further progress. A Goal does not expand scope or grant production permission.
