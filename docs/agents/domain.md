# Domain documentation

Use a single-context layout for this repository.

## Read when relevant

- Read the root `GLOSSARY.md`, if present, when exploring domain terminology.
- Read [DECISIONS.md](../agent-os/DECISIONS.md) when a task could affect an
  established product or architecture decision. It remains the existing durable
  decisions register; follow its links for relevant supporting documentation.
- Read relevant ADRs under `docs/adr/`, if present, when exploring architecture.

Missing glossary or ADR files do not block work. Proceed silently and create
them lazily through domain-modeling only when terms or decisions are resolved
within the authorized task. Setup does not create placeholder domain documents.

## Consumer rules

Use glossary terms consistently in issues, proposals, code, and tests. If a
needed concept is absent, first check existing project terminology; record a
real gap when domain-modeling is relevant to the task.

Keep existing decisions in the current register rather than copying them into
new ADRs. A future ADR may hold additional rationale and be linked from the
register. Surface conflicts with established decisions for explicit resolution
by the product authority before changing behavior or architecture.

Engineering skills complement [WORKFLOW.md](../agent-os/WORKFLOW.md). Apply its
risk-based requirements and selective reading rules; use lightweight handling
for trivial changes. [AGENTS.md](../../AGENTS.md) remains authoritative for
preservation, acceptance criteria, and action permissions.
