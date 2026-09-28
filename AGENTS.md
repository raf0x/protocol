# MyPepProtocol agent rules

MyPepProtocol is a health protocol and tracking application. Canonical workspace:
`C:\Users\three\OneDrive\Desktop\MyPepProtocol\MyPepProtocol-Dev`.
README repository reference: `https://github.com/raf0x/protocol.git`;
production origin: `https://www.mypepprotocol.app/`.

## Scope and preservation

- Preserve all existing user changes, including untracked files. Never edit, stage, delete, or include unrelated work.
- Read only task-relevant files and documentation; do not turn a scoped task into a repository audit.
- Application behavior changes require explicit acceptance criteria. Diagnose-only requests do not authorize implementation.
- Never use `git add .`. When staging is authorized, stage each intended file individually with `git add -- <path>` and exclude unrelated hunks.
- Never commit, push, deploy, or modify Supabase (including data, schema, migrations, auth settings, and templates) without explicit permission for that action.

## Validation and reporting

- Roles are functional, not model-specific: implementer makes scoped changes; independent reviewer evaluates them separately; validator checks acceptance criteria and evidence. Use only the roles requested or needed; this does not require separate agents for every task.
- Run focused tests during implementation. Run TypeScript, production build, and broad regression at the task's agreed release gate, not after every edit; honor narrower task-specific validation limits.
- Separate known baseline failures from new regressions, with evidence. Never weaken, delete, or rewrite tests merely to make them pass.
- Keep user-facing output concise and decision-oriented: outcome, validation, unresolved risks or decisions, and authorization needed.

## Read when relevant

- For multi-step feature, review, validation, or release work, follow [WORKFLOW.md](docs/agent-os/WORKFLOW.md). Do not load it for trivial explanations or one-line edits.
- [PROJECT_STATE.md](docs/agent-os/PROJECT_STATE.md): only when current production state, baseline failures, or active work matters.
- [DECISIONS.md](docs/agent-os/DECISIONS.md): only when a task could affect an established product or architecture decision.
- [TASK_TEMPLATE.md](docs/agent-os/TASK_TEMPLATE.md): use to define a task packet when needed. Do not require every task to read every document.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
