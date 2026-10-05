# MPP-018B — Dosing UX simplification

## Task packet

- Outcome: show one current dose, useful administration facts, next scheduled dose, and at most one actionable issue. Keep the editor's measurement choice and field as its main task.
- Risk: presentation only. Reuse the existing interpreter, phase selection, raw draft and save call. No medical calculation or persistence changes.
- Scope: protocol detail, card and phase presentation; editor grouping and saved-status copy; route CSS; this task record.
- Preserve MPP-017 and MPP-018A in-progress work, plus the unrelated BottomTabBar, Mac checklist and Supabase temp directory. No stage, commit, push, deploy or Supabase operation.
- Stop if implementation requires a calculation, semantics, API, schema, scheduling, inventory or persistence file.
- Validation: existing focused dosing, creation, quick-start, numeric-display and protocol UI tests; TypeScript; `git diff --check`. No build, broad regression, browser suite or release check under the requested limit.

## Presentation decisions

- One primary surface per compound carries its name, medication amount or known draw/volume, frequency and route, next dose, and a compact dose-detail line. The current-phase block no longer repeats the dose.
- One `More details` disclosure holds phase metadata and history, schedule, administration, vial information, stock, notes and change history. Protocol actions remain separate.
- The editor shows the four measurement choices and the selected field. A single `More options` disclosure holds name editing, unit help, administration, vial details, schedule, inventory, phase controls, calculation review and date controls.
- One issue message is selected from existing interpreter warnings. Its text identifies the disagreeing facts and leads to the relevant editor subsection. No derived values or mismatch values are invented. Technical wording stays in the existing nested calculation review.
- The saved status is `Saved`. An unresolved issue remains visible on the relevant protocol card and detail screen.
- Mobile stays one column with large controls. The established save bar remains above bottom navigation and becomes static while inputs are focused, including when a virtual keyboard opens.

## Validation and review

- Focused suite: five files, 106 tests. Initial run passed 105 and found one legacy heading assertion in `tests/protocols.test.mjs`; the heading was restored inside `More details`. The other four files passed 95/95. The affected protocol file then passed 11/11. No tests were changed.
- `npm run validate:types`: passed on the final code.
- `git diff --check`: passed on the final code (only Git CRLF notices).
- Checked preservation hashes for BottomTabBar, Mac handoff checklist, and the MPP-017 interpretation, presentation, form and quick-start logic files; all match their pre-task values. Supabase temp was not touched. The save RPC, calculation, confirmation and date handlers remain unchanged.
- No staging, commit, push, build, broad regression, browser suite, release check or Supabase operation.

Rafael should review `http://localhost:3000/protocol/manage` with a known medication entry and a saved dosing conflict; open the protocol detail, `More details`, and `Edit protocol` with `More options`. Check narrow mobile and desktop widths, keyboard focus and the save bar with the virtual keyboard. Real-browser visual acceptance remains pending under the explicit validation limit.
