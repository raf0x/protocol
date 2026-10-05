# MPP-018F — Compact protocol editor

## Task packet

- Outcome: a normal medication edit defaults to the measurement task, any single dose issue, one More options entry, and Save changes.
- Scope: editor presentation in `app/protocol/manage/page.tsx` and `protocols.css`, with directly relevant UI assertions. Existing dosing interpretation, calculation, payload, save, dates, lifecycle, and inventory logic remain unchanged.
- Preserve all current uncommitted MPP-017 through MPP-018E and unrelated work. No staging, commit, push, deploy, or Supabase operation.

## Presentation decisions

- More options has six summary cards: Administration, Vial, Schedule, Inventory, Phases, and Other. One selected panel displays at a time; hidden inputs stay mounted so draft values remain intact.
- The primary review action opens the relevant panel. Calculation details and the optional confirmation sit with vial review only when an existing dosing issue calls for review. There is no permanent Review accordion.
- Name, dates, continuation, unit help, and adding another compound move into Other. The existing Save changes action stays in its sticky bar above the mobile navigation.
- Two card columns are used on most mobile widths and three at wider widths. Secondary field groups use two columns where space permits.

## Validation and review

The final focused suite passed 80 tests across four relevant UI/dosing files, with 0 failures. `npm run validate:types` and `git diff --check` passed. Browser validation, build, and full regression are excluded by this task, so the 50% height target has not been measured. Review `http://localhost:3000/protocol/manage` by opening a saved protocol for edit, checking the closed editor and each More options card at mobile and desktop widths, and checking a protocol with a vial warning.
