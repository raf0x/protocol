# MPP-018A — UI system V2 and dosing editor

## Task packet

- Outcome: a calm, measurement-first Edit protocol screen, with mode-specific inputs and progressively disclosed secondary details.
- Risk: low, presentation only. Existing MPP-017 state, interpretation, confirmation, hydration, save paths, dates, inventory and persistence remain authoritative.
- Scope: manage-page JSX/CSS, a small reusable dose presentation component, protocol detail/card/phase dose displays, and this task record. No calculation or logic file changes.
- Acceptance: four measurement choices precede their fields; syringe units/scale/derived volume, medication amount and volume are readable; unknown mode is reassuring; conflicts stay visible in plain English; secondary sections collapse; mobile controls and keyboard focus remain usable.
- Preserve all existing local work, including MPP-017 and the explicitly excluded BottomTabBar, handoff checklist and Supabase temp files.
- Budget: unspecified. Stop if calculation or persistence changes become necessary.
- Authorization: no staging, commit, push, deployment or Supabase changes.
- Review: implementation self-review for this presentation-only scope; independent review not requested. Rafael's visual acceptance remains pending.

## Validation plan

Only the requested checks: existing focused dosing/creation/quick-start/numeric-display tests, `npm run validate:types`, and `git diff --check`. No full regression, production build, release validation or browser test suite. No tests will be rewritten to accommodate the presentation change.

## Results

### UX and visual system

- Before: medication, administration, preparation, inventory, schedule and calculation review competed in the editor at once.
- After: the compound name and four large measurement choices lead. The saved mode remains selected. Medication shows amount/unit; syringe shows draw/scale and a rounded volume helper; volume shows mL; unknown invites optional known facts.
- Administration, vial/concentration, inventory/notes, schedule, phases, calculation review and protocol dates/links are native disclosures. Confirmation remains bound to the original `reviewed` value, inside Administration.
- Conflicts appear outside disclosures as “Dose needs review,” separate entered facts, and “Some dosing details don’t match.” Review opens the relevant details and focuses their summary. Missing medication reads “Medication amount unknown”; its old wording remains a secondary tooltip. Original diagnostic notes remain in the collapsed calculation review.
- Shared `DoseSummary` renders editor, detail, phase and library-card amounts without a diagnostic sentence as the primary display. Interpretation and rounding come from existing helpers; no formulas were added.
- Scoped visual tokens: 24px surfaces, 14px controls, 24px grouping space, restrained existing accent, larger values, quiet secondary actions, and a single dominant Save changes action.
- Mobile uses one column of choices below 480px, 52–64px inputs, and a sticky save bar above navigation. Desktop uses a two-column choice grid with a 640px maximum form width; input groups remain vertical.
- Accessibility: native buttons and disclosures, selected-state announcements, visible focus rings, associated dose label, polite live feedback, decimal keyboards, explicit focus on review, and reduced-motion handling. No decorative motion added.

### Files changed by MPP-018A

- `app/protocol/manage/page.tsx`: editor hierarchy, disclosures and human labels; original MPP-017 handlers retained.
- `app/protocol/manage/protocols.css`: scoped editor styling and shared dose-display typography.
- `components/protocols/DoseSummary.tsx`: small presentation component using the existing interpreter.
- `components/protocols/ProtocolDetail.tsx`, `PhaseCard.tsx`, `ProtocolCard.tsx`: use the readable dose summary.
- `components/protocols/QuickProtocolFields.tsx`: reassuring unknown-mode sentence only; create-wizard flow unchanged.
- This task document.

### Validation evidence

- Existing focused command: `npm run validate:focused -- tests/dosing-entry.test.mjs tests/protocol-creation.test.mjs tests/protocol-quick-start.test.mjs tests/protocol-numeric-display.test.mjs tests/protocols.test.mjs`.
- First pass: 104/106 passed. Checkbox-order and legacy status-text compatibility failures were corrected without editing tests.
- Final focused run: **106/106 passed across 5 files**, 0 failed, 0 skipped, 0 cancelled, 0 todo (109.516 seconds).
- `npm run validate:types`: passed after presentation corrections (8.252 seconds).
- `git diff --check`: passed; only existing CRLF conversion notices.
- Hash comparison confirms no changes to `BottomTabBar.tsx`, `mac-handoff-checklist.md`, or the MPP-017 dosing-entry, presentation, form and quick-start logic files. No other MPP-017 implementation/test files were edited. Supabase temp files were not touched.
- Preserved: formulas, U-100/U-40 interpretation, raw facts, confirmation resets, legacy/phase hydration, save/API paths, scheduling, lifecycle, inventory and persistence. No staging, commit, push, deployment or Supabase operations.

### Remaining visual acceptance and review pages

Browser/manual visual QA was not run under the explicit validation limits. Mobile overflow, virtual-keyboard/save-bar placement, light/dark appearance, focus movement and screen-reader announcements still need real-browser acceptance. No production build, full regression or release check was run. The create wizard retains its existing visual flow; only its unknown-mode reassurance changed.

With the local dev server on its default port:

- `http://localhost:3000/protocol/manage`: open a protocol, inspect the detail summary, then select **Edit protocol**. Review all four modes; U-100 and U-40; 18 U-100 units with a conflicting entered 10 mL; unsupported historical scales; phase changes; and optional confirmation. Check 320px/390px mobile and desktop widths.
- `http://localhost:3000/protocol/manage?new=1`: check the unchanged create flow and its updated unknown-mode reassurance.

Visual acceptance remains Rafael's next step. Automated checks do not constitute visual acceptance or release approval.
