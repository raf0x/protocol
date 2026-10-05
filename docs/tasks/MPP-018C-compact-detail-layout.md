# MPP-018C — Compact detail layout

## Task packet

- Outcome: reduce protocol detail height while keeping the current compound, medication amount, schedule, administration and one actionable issue visible.
- Risk: presentation only. Existing MPP-017 interpretation and MPP-018A/B save, confirmation, hydration and persistence remain authoritative.
- Scope: `ProtocolDetail`, `PhaseCard`, `ProtocolCard`, route CSS, and this record. No calculation or state files.
- Preserve all in-progress MPP-017/018A/018B work and unrelated BottomTabBar, Mac checklist, and Supabase temp files. No staging, commit, push, deploy or Supabase operation.
- Stop if a calculation, dosing semantics, save, API, scheduling, lifecycle or inventory logic file becomes necessary.

## Presentation changes

- The main dose surface retains the compound name, primary amount, frequency/route, next dose, administration summary and one issue. Padding and spaces are reduced; next dose and administration can share a row when there is room.
- `More details` stays closed initially. Administration, reconstitution, inventory, schedule and phase metadata use compact rows. Desktop uses two columns; narrow screens use one column with label and value on the same row.
- `Show phases` and `Show history` are independently closed. Opening history initially shows five recent changes and five recent logs; `Show more history` reveals the previously loaded set of up to 50 each. Data fetch and history ordering are unchanged.
- Library cards use the name, primary dose, one issue if present, a schedule line and a status/next-dose line. Completed dates move into the compact status line.
- Current phase metadata remains accessible without a repeated current-dose block. Protocol actions remain separate.

## Validation and visual review

Focused UI/dosing validation passed: 106 tests, 0 failures across five relevant files; after the final date-display adjustment, the two affected files passed again (26 tests, 0 failures). `npm run validate:types` passed after the final adjustment. `git diff --check` passed. Browser visual review is deferred under the explicit validation limit, so the requested 30–40% height reduction has not been measured. Review `http://localhost:3000/protocol/manage`: open a known-dose protocol and a conflict, then compare the closed detail, expanded More details, Show phases and Show history at narrow mobile and desktop widths.
