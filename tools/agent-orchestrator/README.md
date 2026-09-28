# AOS-004A deterministic orchestration core

This directory contains a local, single-task coordinator that proves orchestration policy with deterministic fake agent and validation adapters. It is not connected to Codex or another live agent runtime, and it is not a security sandbox.

The coordinator pins an approved task packet, Git/index/workspace fingerprints, and base commit; routes roles from risk; validates the complete proposal before mutation; hashes exact candidate bytes deterministically; invalidates candidate-bound evidence after changes; preserves agent identities and correction-attempt state across resume; and writes five schema- and cross-artifact-validated JSON artifacts before persisting readiness. Its only successful terminal state is an unstaged `READY_FOR_HANDOFF` candidate. Stage, commit, push, deploy, and Supabase execution are all `outside_v1`.

Run the disposable safe trial with:

```powershell
node tools/agent-orchestrator/cli.mjs trial
```

Pass `--keep` to retain the synthetic workspace under the operating-system temporary directory for inspection. The trial has no remote and never uses the canonical MyPepProtocol checkout as its candidate workspace.

Run the focused contract tests through the repository harness:

```powershell
npm run validate:focused -- tests/agent-orchestrator.test.mjs
```

## Boundaries

- Fake agents return scripted proposals only; they cannot write authoritative state, artifacts, or workspace files.
- The coordinator accepts only packet-approved relative paths and regular-file operations. Delete/rename permission comes only from an approved high-risk `mutationPolicy`; agent self-authorization is ignored. Traversal, every case variant of a `.git` component, Windows aliases, directory targets, operation conflicts, and detectable link escapes fail before mutation.
- Candidate writes use exclusive random files under a collision-checked coordinator directory inside the disposable workspace. Candidate hashes use bytes read back from disk.
- Validation uses scripted evidence. The exported real-command map contains fixed executable/argument arrays as an integration seam; agent-supplied command strings are never executed.
- State is atomically replaced in a run-state directory separate from the artifact directory. Resume recomputes packet, role, identity, counter, candidate, evidence, QA, validation, readiness, and artifact invariants before continuing or returning a persisted handoff.
- There is no recursive delegation, release executor, web UI, database, queue, distributed worker, or multi-task scheduler.
