# MPP-019A — Today UX rework

## Scope and acceptance

Continue the uncommitted MPP-019 implementation with the owner's approved UX revision. Medium-risk presentation/UI work; no release authorization. Rings become the centered visual anchor, with every selectable row beside them on desktop and below on mobile. Replace the selected-tools disclosure with an always-visible compact snapshot containing the nine requested facts, medication/name and existing vial visual. Remove Recent Changes and All doses today from Today. Compact Focus while preserving ordering, browsing, completion and Mark taken behavior. Prompt for a missing local-day check-in through a dismissible native modal and keep an obvious manual entry point.

Use existing snapshot calculations and existing check-in data/actions. New prompt state is presentation-only; no new backend flow or persistent storage. Treat an existing journal entry for the local day as recorded; a missing day prompts once per account/day in the current app session, with manual reopening after dismissal. Today is the application's existing landing route. Successful score writes can acknowledge the day in UI memory without changing writes or closing the modal mid-entry. Preserve all existing calculation, save, confirmation, API, Supabase, schema, migration, editor and bottom-nav behavior.

## Preservation and baseline

At intake, recorded SHA-256 hashes for all 61 existing dirty/untracked files. Saved copies of the current Today page and HeroProtocolCard outside the repository to verify additive changes against MPP-017/018/019 work. Only the scoped Today composition/layout, ref support on the shared secondary button, presentation branch of HeroProtocolCard, relevant tests/fixture and this packet may change. Shared dosing/date/inventory/health helpers, protocol editors, BottomTabBar, Supabase and unrelated files remain untouched.

MPP-019's prior evidence: 174 focused tests, 173 passed and one pre-existing unrelated onboarding assertion failure (`route` versus `dose`). The final directly affected Today tests passed 31/31. The new scope supersedes its selected-tools/all-doses/check-in disclosures and Recent Changes presentation; it does not supersede data or calculation contracts.

## Validation gate

Run only `npm run validate:focused -- <directly relevant Today/dashboard/UI tests>`, `npm run validate:types`, and `git diff --check`. No browser run, full regression, production build, staging, commit, push, deployment or Supabase mutation. Preserve existing behavioral assertions; update only expectations superseded by this explicit UX revision. Stop any dependent work that would require changes to protected calculations or persistence.

## Result

Implemented the compact action strip with existing untaken-dose browsing, disabled/saving/error states and completion progress. Rings now use the full-width main section with a centered cluster up to 420px, the selectable list beside it at desktop widths and below on mobile. The ring grouping/selection algorithm is unchanged.

Selected protocol facts are always visible below rings/list: start, week, reconstitution, expiration, volume, syringe draw, stock, doses taken and next dose. The snapshot uses existing HeroProtocolCard values, medication summary and vial SVG. Missing values remain explicit; existing inventory, phase actions and completion confirmation stay connected. Selected protocol tools, All doses today and Recent Changes no longer render on Today.

The daily prompt waits for a successful local-day journal load. A dated entry suppresses automatic prompting; a successful score save acknowledges the day in UI memory while leaving the other fields available. Native dialog supports Escape, close, outside-backdrop click, Skip/Done, focus restoration and manual reopening. Parent-owned drafts survive dismissal. Dismissal is remembered across client navigation per account/day; a full reload can prompt again if the day is still missing, because persistent storage and backend behavior are unchanged.

### Changed files (MPP-019A only)

- `app/protocol/page.tsx`: connect snapshot and prompt to existing state/actions.
- `app/protocol/today-v2.module.css`: compact Focus, centered rings, responsive snapshot and dialog styling.
- `components/app/DesignSystem.tsx`: allow the secondary button's native ref for dialog focus restoration.
- `components/dashboard/HeroProtocolCard.tsx`: optional snapshot presentation; original calculations, default presentation, mutations and confirmation retained.
- `components/today/ActiveProtocolList.tsx`: always-visible snapshot below the controls.
- `components/today/TodayOverview.tsx`: simplified section composition without Recent Changes.
- `components/today/TodaysFocusCard.tsx`: compact dose action and browsing, without disclosures.
- `components/today/SelectedProtocolSnapshot.tsx` (new): presentation-only name, medication, vial and fact grid.
- `components/today/DailyCheckInPrompt.tsx` (new): session-memory prompt and native dialog.
- `tests/today.test.mjs`: update explicitly superseded surface expectations.
- `tests/today-v2.test.mjs`: snapshot values, missing/zero/legacy values, synchronized selection and retained confirmation.
- `tests/today-checkin-prompt.test.mjs` (new): prompt eligibility, date/account changes, dismissal, reopen, saves and focus lifecycle.
- `tests/today-v2.browser.cjs`: align the existing future browser fixture with snapshot/modal; not executed in this gate.
- `docs/tasks/MPP-019A-today-ux-rework.md` (new): scope and handoff evidence.

### Validation and preservation

- `npm run validate:focused -- tests/today.test.mjs tests/today-dose-order.test.mjs tests/today-v2.test.mjs tests/today-checkin-prompt.test.mjs tests/protocol-numeric-display.test.mjs`: **58 passed, 0 failed, 0 skipped**. An initial new confirmation test expected the wrong title; corrected it to the unchanged `Mark as Complete?` title. No production behavior was altered for the test.
- `npm run validate:types`: **PASS**.
- `git diff --check`: **PASS** (exit 0; existing LF/CRLF conversion notices only).
- Hash comparison: 51 of the 61 pre-existing dirty/untracked files remain byte-identical; the other 10 are the intended MPP-019A edits listed above. Four new scoped files were added. Saved-copy diffs confirm Hero calculations and mutation/confirmation code are unchanged; the page only adds UI state acknowledgements/wrappers without changing database reads or writes.
- No backend, API, Supabase, schema, migration, dosing, inventory, timeline, health calculation, editor or bottom-nav edits. No staging, commit, push or deployment.
- Browser, production build and full regression were not run, per the task's narrower limits. Automated modal tests use a fake native dialog for lifecycle checks; real browser focus trapping, responsive appearance and mobile keyboard behavior are unverified. Owner visual QA and independent review remain before a release gate; prior MPP-019 screenshots are not evidence for this revision.
