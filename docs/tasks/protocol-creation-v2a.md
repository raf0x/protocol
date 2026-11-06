# Protocol Creation V2A implementation handoff

- Branch: `feature/protocol-creation-v2a`
- Baseline: `483895b568479672a80fcca20d5d1070b607f5be`
- Risk: high (display-only medication arithmetic). One implementer; independent review remains required.
- Scope: new creation only; three stages, recorded facts separated from calculated equivalents. No production publication or database changes authorized.

## Accepted contract and implementation

The Product Lead approved optional `final_solution_volume_ml` (string) and explicit preparation confirmation. This implementation uses optional `preparation_confirmed` (boolean). Missing confirmation is never true. `bac_water_ml` remains liquid added; `concentration_value` remains a separately recorded fact. Derived concentration, volume, markings and medication equivalents never enter the persistence payload.

Preview requires confirmed preparation, reviewed measurement, supported units, consistent facts and explicit syringe calibration when markings are involved. Imported setup facts cannot confirm a new preparation. Preparation edits invalidate confirmation. IU never converts to mass. Display values use approximately-equal notation and disclose rounding.

`interpretEntry`, recorded-dose displays, historicalSave behavior, Today, identity, inventory and authentication are unchanged. `creationMeasurement.ts` is pure display arithmetic used only by the creation UI. The shared entry adapter serializes the optional fields without backfilling old entries.

## Persistence checkpoint

Repository SQL: `202609200001_planned_protocols.sql` inserts/updates the complete `ph->'dosing_entry'` JSON. The `require_medication_dose_v1` trigger validates existing required fields without removing extra keys. The latest `save_protocol_with_events_v2` wrapper delegates to these canonical functions. Existing reload selects `phases.dosing_entry`; `entryFormState` preserves additional fields. No migration or database-function change is needed.

The synthetic PGlite test executes the existing migration definitions locally, calls the canonical RPC, reloads the phase, and checks exact JSON, schedule, empty legacy medication columns, unchanged compound preparation columns and owner isolation. It does not access Supabase or real records.

## Verification and acceptance

Focused suite: 193 passed, zero failed/skipped. Covers final volume versus liquid added, supported mass/IU units, labeled concentration, conflicts, missing/invalid inputs, explicit U-100/U-40, legacy JSON, historical save preservation, Today and treatment identity. Four existing creation UI tests were updated for the approved stage/control changes while retaining their preservation/save assertions.

Mobile browser: passed at 390 x 844 using real creation components and existing styles, synthetic data and disabled fetch/XHR. Checks explicit calibration, equivalent, schedule and payload, no horizontal overflow or runtime errors. Preparation screenshot visually inspected. TypeScript passed. Optimized production build passed (Next.js 16.2.6).

Broad regression is deferred to the agreed release gate. Independent review, actual iPhone/Safari QA, and Product Lead acceptance remain outstanding. Database evidence is local repository-SQL evidence, not verification of deployed database state.

## Safe preview and rollback

From this worktree, run `node tests/protocol-creation-v2a.browser.cjs --serve` and open the printed localhost URL. All data is synthetic; Save only captures the payload in memory. Stop with Ctrl+C. Automated check: `npm run validate:browser -- tests/protocol-creation-v2a.browser.cjs`.

For rollback, restore the prior creation UI while retaining optional-field serialization/read compatibility for any entries created after an eventual authorized release. Do not remove optional JSON fields or rewrite historical records. No staging, commit, push, deployment, schema mutation or App Store rebuild was performed.

## Targeted UX corrections � 2026-11-05

The independent review approved preview preparation. This correction addresses its UX findings; the correction itself awaits independent recheck.

Correction-only files (7): `components/protocols/CreationMeasurement.tsx`, `components/protocols/ProtocolQuickStart.tsx`, `lib/protocols/quickStart.ts`, `tests/protocol-creation-v2a.test.mjs`, `tests/protocol-creation-v2a-sql.test.mjs`, `tests/protocol-creation-v2a.browser.cjs`, and this report. The complete V2A worktree still contains 14 changed files against the unchanged baseline HEAD.

- Reproduced the negative vial amount advancing to Measurement with a failing UI test. Preparation amounts now validate independently at their own fields, including when a measurement is also invalid. Save returns preparation errors to Preparation. Retained invalid fields are exposed for correction without discarding facts or changing preparation semantics.
- Reused existing amount/error controls for field IDs, `aria-invalid`, and `aria-describedby`; mode/calibration groups have associated errors. Validation focuses the offending control and opens its disclosure, including repeated Continue attempts. Duplicate preparation/measurement summary announcements were removed.
- Review uses plain-English preparation labels. Calibration appears for syringe mode or recorded syringe facts, preserving visible saved information without adding an irrelevant unconfirmed-calibration row to ordinary medication/volume entries.
- Optional route approved locally: an empty route remains empty in the draft and becomes `null` through the unchanged canonical adapter. Existing SQL accepts it; daily, weekly and rolling schedules round-trip unchanged. `isDueToday` has no route dependency. The UI offers �Not specified� and uses existing neutral timing language. No route is inferred.

Final local verification:

- `npm run validate:focused -- tests/protocol-creation-v2a.test.mjs tests/protocol-creation-v2a-sql.test.mjs tests/protocol-quick-start.test.mjs tests/dosing-entry.test.mjs`: 65 passed, zero failed/skipped.
- `npm run validate:browser -- tests/protocol-creation-v2a.browser.cjs`: passed at 390 x 844. Covers preparation/measurement errors, focus, hidden-field disclosure, repeated submission, explicit calibration, equivalent, null route and canonical payload. Final evidence: `C:\Users\three\AppData\Local\Temp\mpp-v2a-ySQHnm\evidence`; corrected error screenshot visually inspected.
- `npm run validate:types`: passed. `npm run validate:build`: passed against final application sources; prior optimized-build evidence was not reused after source changes. `git diff --check`: passed.
- Broad regression not run. Actual iPhone/Safari and assistive-technology QA remain outstanding.

Calculation gates, final-volume arithmetic, stored values, historical records, inventory/New Vial boundaries, identity, ownership, auth, Today and database definitions were not changed by this correction. No staging, commits, pushes, deployment, production/Supabase access or App Store rebuild. Recommendation: CORRECTIONS READY FOR INDEPENDENT RECHECK.

## Final integration and visual onboarding — 2026-11-05

Local-only follow-up to preview commit `d71c97606261fce8171ce4e995028386c1c348c6`. This section supersedes earlier verification for the current uncommitted changes.

- Four questions within the existing three stages: compound, vial amount, mixed status, intended measurement. Mixed preparation reveals water/date; ready-to-use reveals label concentration. Final volume remains optional disclosure. Mixing status is draft-only. No second persistence path or calculated concentration write.
- A small read-only preparation presentation contract prefers the selected phase's paired amount/unit, blocks fallback for incomplete/malformed entries, and labels legacy-only facts. Both Hero variants and Detail use it. Saved facts explicitly do not establish the physical vial. Five initial component tests failed against the previous Hero/unknown artwork and passed after the correction.
- Valid reconstitution dates produce a separate 28-calendar-day check reminder (November 1 → November 29), explicitly not expiration or safe-use assurance. Actual expiration records and New Vial restrictions are unchanged.
- Reused V0.6.4 glass geometry, neutral striped unknown interior, responsive label, compact teal panels, lightweight calibration schematic without a fill level, 220ms transitions, reduced-motion support. All equivalents require explicit supported calibration. Today's Focus layout files remain unchanged.

Validation:

- 237 focused tests passing across targeted runs: 217 unaffected tests plus all 20 vial-safety tests after updating approved source/copy expectations. Historical preservation, identity, Today, conflict/unit boundaries, missing preparation, legacy fallback, date edges and exact reload included. No broad regression.
- Actual creation interactions → canonical payload → reload adapter → Detail and both Heroes pass in the network-disabled 390px browser fixture. Local PGlite executes unchanged repository RPC definitions and checks exact preparation JSON, reload component output, schedules and owner isolation. No Supabase accessed.
- Creation screenshots: `C:\Users\three\AppData\Local\Temp\mpp-v2a-jZ7b87\evidence` (preparation, measurement, review, equivalent, Detail, both Heroes, unknown-versus-empty). Visually inspected; keyboard, reduced motion, layout bounds and runtime checks passed.
- Vial safety browser: 2,125 assertions, 27 screenshots, dark/light at 320px/390px. New Vial containment, unchanged records, correction flows and reduced motion passed. Report: `C:\Users\three\AppData\Local\Temp\mpp-v2a-vial-safety-8889912cd50d442aab0a2df12f066905\vial-safety-browser-report.json`. Prior QA archives preserved.
- `validate:types` passed. `validate:build` passed (optimized compile, TypeScript, route generation). No application source edits after these checks. Git whitespace checks passed.

Exact changed files (22, relative to this worktree):

```text
app/protocol/manage/protocols.css
components/dashboard/HeroProtocolCard.tsx
components/dashboard/VialInventory.tsx
components/protocols/CreationArtwork.tsx (new)
components/protocols/CreationMeasurement.tsx
components/protocols/ProtocolDetail.tsx
components/protocols/ProtocolQuickStart.tsx
components/today/EnhancedVial.tsx
components/today/enhanced-artwork.module.css
lib/health/preparationPresentation.ts (new)
lib/protocols/creationMeasurement.ts
lib/protocols/creationSteps.ts
lib/protocols/form.ts
tests/protocol-creation-v2a-sql.test.mjs
tests/protocol-creation-v2a.browser.cjs
tests/protocol-creation-v2a.test.mjs
tests/protocol-preparation-presentation.test.mjs (new)
tests/protocol-quick-start.test.mjs
tests/today-v2.test.mjs
tests/vial-safety.browser.cjs
tests/vial-safety.test.mjs
docs/tasks/protocol-creation-v2a.md
```

Limitations: synthetic/local SQL evidence is not production persistence certification; real iPhone/Safari and assistive-technology review remain. The check reminder is displayed, not a scheduled notification. Safe preview: `node tests/protocol-creation-v2a.browser.cjs --serve`; use only its localhost fixture. No staging, commit, push, PR update, deployment, migrations, real health data or App Store changes.

Recommendation: READY FOR INDEPENDENT REVIEW.

Git validation note: `validate:git` requires staged paths, so it is inapplicable under this task's no-staging restriction. The index remains empty; direct `git diff --check` and checks of the three new files are the applicable validation.

## Final two corrections — 2026-11-05

Scope: only the ready-to-use calculation blocker and light-theme syringe visibility; preceding uncommitted V2A work is preserved. HEAD remains `d71c97606261fce8171ce4e995028386c1c348c6`.

The exact component reproduction failed with “A vial amount, medication unit and confirmed final solution volume are needed.” Ready-to-use vial amount alone no longer activates a second concentration source. A recorded final volume still activates consistency comparison; mixing still requires it. Retained fields are preserved, conflicting preparation names the relevant fields, and optional review controls allow explicit corrections with confirmation reset. No persistence adapter or historical behavior changed.

Light-only ink, tick weight and numeral size improve the existing SVG at 320/390px. Dark colors, geometry and reduced-motion behavior remain unchanged.

Files changed by this correction (7):
- `lib/protocols/creationMeasurement.ts`
- `components/protocols/CreationMeasurement.tsx`
- `components/protocols/CreationArtwork.tsx`
- `app/protocol/manage/protocols.css`
- `tests/protocol-creation-v2a.test.mjs`
- `tests/protocol-creation-v2a.browser.cjs`
- `docs/tasks/protocol-creation-v2a.md`

Validation: 99 tests passed, zero failed/skipped, across creation, quick-start and historical-save preservation. Exact 10 mg retained / 5 mg/mL label / 1 mg intended / U-100 scenario yields the informational 20-marking equivalent. Mixed, partial/conflicting preparation, unit/IU boundaries, explicit calibration, confirmation and fact preservation remain covered. Synthetic browser passed exact reproduction, recovery in mixed and ready paths, light 320/390px, dark colors, reduced motion, four-question flow and existing Detail/both-Hero reload integration. Prior SQL/owner-isolation evidence remains applicable; persistence code is unchanged.

`validate:types`, optimized `validate:build` and direct `git diff --check` passed. No broad regression. Visual evidence, inspected locally: `C:\Users\three\AppData\Local\Temp\mpp-v2a-mURaJx\evidence` (`ready-light-320.png`, `ready-light-390.png`, `ready-dark-390.png`, `ready-conflict.png`). No known remaining defect from scoped checks; physical Safari and production persistence are not certified by synthetic QA. No staging, commits, pushes, PR updates, deployment, Supabase access or real-data changes.

Recommendation: CORRECTIONS READY FOR INDEPENDENT RECHECK.
