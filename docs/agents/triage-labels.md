# Triage labels

Map the engineering skills' canonical roles to these GitHub labels in
`raf0x/protocol`:

| Canonical role | GitHub label | Meaning |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Maintainer needs to evaluate the issue. |
| `needs-info` | `question` | Further information is requested. |
| `ready-for-agent` | `ready-for-agent` | Specified engineering work ready for Codex within approved scope. |
| `ready-for-human` | `ready-for-human` | Requires human implementation or judgment. |
| `wontfix` | `wontfix` | Will not be worked on. |

Reuse the existing `question` and `wontfix` labels. Setup adds only
`needs-triage`, `ready-for-agent`, and `ready-for-human`; all other existing labels
retain their names, descriptions, colors, and uses. Do not create a separate
`needs-info` label. The `question` label may also appear on general questions;
read the issue before treating it as a request for missing information.

Readiness labels describe engineering status. Follow the product and engineering
authority hierarchy in [CLAUDE.md](../../CLAUDE.md#agent-skills);
repository authorization rules still apply.
