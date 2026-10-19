# Issue tracker: GitHub

Issues and specs live in GitHub Issues in `raf0x/protocol`.
Read [AGENTS.md](../../AGENTS.md) for authorization boundaries and follow
[WORKFLOW.md](../agent-os/WORKFLOW.md) when its task conditions apply.
Follow the product and engineering authority hierarchy in
[CLAUDE.md](../../CLAUDE.md#agent-skills).
A ticket or readiness label does not independently authorize implementation or release.

## Operations

Use the `gh` CLI when available, with explicit `--repo raf0x/protocol`:

- Read: `gh issue view <number> --repo raf0x/protocol --json number,title,body,labels,comments`.
- List: `gh issue list --repo raf0x/protocol --state open --json number,title,body,labels`, adding relevant label filters.
- Create an authorized ticket: `gh issue create --repo raf0x/protocol --title "..." --body-file <file>`.
- Comment: `gh issue comment <number> --repo raf0x/protocol --body-file <file>`.
- Label: `gh issue edit <number> --repo raf0x/protocol --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --repo raf0x/protocol` when authorized by the task.

Write multiline bodies to a temporary UTF-8 file and pass `--body-file`.
If `gh` is unavailable, use a connected GitHub tool or the authenticated GitHub
API for the same scoped operation. Report unavailable access instead of changing
trackers or creating local duplicate tickets.

When a skill says "publish to the issue tracker", create the authorized GitHub
issue; when it says "fetch the relevant ticket", read the matching issue.
Use [triage-labels.md](triage-labels.md) for role-to-label mapping.

## Pull requests as a triage surface

**PRs as a request surface: no.**
