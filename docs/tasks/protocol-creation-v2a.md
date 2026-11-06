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


## Mobile UX rescue - local verification, 2026-11-05

Baseline: feature/protocol-creation-v2a at 7dee46ca91e89bdc27dc95ace353b2185f69b386. No staged changes, commits, publication, service access or database changes.

Active Compound now has a mobile-only stacked heading and full-width vial section, with recorded amount, unknown remaining, recorded date and one reminder disclosure. More protocol details contains secondary facts and the current-physical-vial caveat. New Vial and its existing restriction remain accessible. Both Hero variants use the existing premium SVG; desktop columns and facts remain visible. No document overflow hiding was added. At 320px the snapshot content shrank from 896 to 470 CSS pixels (outer card approximately 571px after); all four widths use the same compact content height. The baseline fixture reproduced cramped columns/blank space, but did not reproduce the reported horizontal overflow.

### Current creation-field classification

| Fields/prompts | Classification and primary-path treatment |
| --- | --- |
| Compound; frequency, chosen weekdays or rolling interval | Essential saving/scheduling inputs; stay visible with conditional days/interval. |
| Start choice and date | Essential lifecycle decision; stays visible, with unknown/planned still supported. |
| Vial amount/unit; mixed/ready/unknown; liquid added and date when mixed | Core requested recorded facts; remain primary. Existing ability to leave unknown facts blank is unchanged. |
| Intended amount/unit or selected raw markings/mL | Core recorded measurement; primary. Units remain explicit and unknown values remain supported. |
| Medication/marking/volume/unknown choice | Unnecessary repeated primary decision for the default medication path; available under Change how I record the amount. |
| Syringe calibration; labeled concentration/unit; final solution volume | Only necessary for optional equivalence; hidden until requested. No inferred defaults. |
| Preparation and measurement confirmations | Essential safety gates for equivalence; retained with concise contextual wording in that disclosure. |
| Retained preparation-source review | Optional conflict review; preserved inside equivalence, with hidden validation errors still revealed/focused. |
| Route; time of day; duration/weeks; stock; label and notes | Optional advanced information. Route/stock/notes remain disclosed; timing/duration moved into a closed disclosure. |
| Full saved-facts/equivalent review table; calibration artwork prompt | Redundant primary detail/nag; facts remain expandable, artwork caption is neutral. |

No calculation, persistence, historical-save, auth, treatment identity or current-vial inventory contract changed. No recorded facts are cleared by these presentation changes. Four questions and three stages remain.

### Verification and evidence

- 110 distinct focused tests pass: existing 109 across creation, quick-start, preparation presentation, Today and vial safety; creation rerun passes 20 including the added primary-disclosure test. No failures/skips. Prior historical-save and SQL compatibility evidence remains applicable because their logic and contracts are unchanged.
- Synthetic browser PASS: all three creation stages and both Heroes at 320/375/390/402 in light/dark; no horizontal overflow or clipped visible controls; prominent unchanged vial artwork, disclosures, New Vial restriction, Manage/Inventory links, reduced motion, keyboard/error focus, advanced inputs initially hidden. Desktop 1280px columns/facts preserved.
- Creation -> canonical payload -> JSON reload -> Detail/both Heroes preserves selected-phase amount, liquid added, final volume and date. No calculated medication written, unknown remaining has no liquid fill. Existing ready-to-use, mixed/conflict, explicit U-100/U-40 and unit-boundary checks remain passing. Today's Focus implementation is untouched; its focused behavior tests pass.
- TypeScript PASS; optimized build PASS (38 static pages); direct diff whitespace check PASS. No broad regression.
- Before Hero evidence: C:\Users\three\AppData\Local\Temp\mpp-v2a-1ClMvz\evidence (hero-dark-320.png and other widths/themes).
- Before primary onboarding: C:\Users\three\AppData\Local\Temp\mpp-v2a-8yormc\evidence (onboarding-dark-390.png and other widths/themes), rendered from the immutable pre-change synthetic HTML.
- Final evidence: C:\Users\three\AppData\Local\Temp\mpp-v2a-Uww5Rk\evidence. Includes hero-*, full-hero-*, preparation-*, onboarding-*, review-*, desktop-hero.png and mobile-geometry.json. Screenshots inspected locally.
- Logs: %TEMP%/mpp-v2a-mobile-focused.log, mpp-v2a-mobile-disclosure.log, mpp-v2a-mobile-browser.log, mpp-v2a-mobile-types.log, mpp-v2a-mobile-build.log.

Changed files (14):
- components/dashboard/HeroProtocolCard.module.css (new)
- components/dashboard/HeroProtocolCard.tsx
- components/dashboard/VialInventory.module.css
- components/dashboard/VialInventory.tsx
- components/today/EnhancedVial.tsx
- components/today/SelectedProtocolSnapshot.tsx
- components/protocols/CreationArtwork.tsx
- components/protocols/CreationMeasurement.tsx
- components/protocols/ProtocolQuickStart.tsx
- components/protocols/QuickProtocolFields.tsx
- tests/protocol-creation-v2a.browser.cjs
- tests/protocol-creation-v2a.test.mjs
- tests/protocol-quick-start.test.mjs
- docs/tasks/protocol-creation-v2a.md

Safe local review: node tests/protocol-creation-v2a.browser.cjs --serve. This fixture blocks network requests and uses only synthetic data. No known scoped defect remains; physical iPhone/Safari, assistive technology and real persistence integration are not certified by this synthetic check. Production release remains unauthorized.

Recommendation: READY FOR MOBILE REVIEW.


## Final Hero data and UX correction - local only, 2026-11-05

Baseline HEAD: 9aa55c94f6660edb96d0585ffbe7ea74105dd2d3 on feature/protocol-creation-v2a. No staging, commits, publication, Supabase access, migrations or real-data writes.

### Source verification and classifications

| Fact | Inspected source and classification | Final display contract |
| --- | --- | --- |
| Vial amount/unit | preparationPresentation(compound, selected phase): phase dosing_entry pair; only absent phase entry permits labeled legacy fallback. Recorded. | Same selector and provenance, including 30 mg. No mixing of amount/unit sources. |
| Reconstitution | Compound reconstitution_date, selected by preparationPresentation. Recorded but formerly repeated. | One visible Reconstituted date. |
| 28-day check | reconstitutionCheckReminder adds 28 calendar days. Derivable. | One visible 28-day check date; secondary explanation explicitly says tracking only, not expiration or safe-use. Nov 1 -> Nov 29. |
| Expiration | No linked individual-vial expiration is supplied to Hero. Genuinely missing there; inventory expiration_date is an independent recorded source. | Remove fabricated/unknown Hero expiration row; preserve Inventory's recorded expiration and source label unchanged. No new inventory lookup/link inferred. |
| Syringe and volume | recordedDose selects V2 dosing_entry, otherwise legacy phase fields. Markings/scale are recorded; volume is derivable only from valid supported calibration in a confirmed V2 entry of known mode. | 50 units / U-100; Calculated volume 0.5 mL. U-40 also supported. No concentration or medication calculation. Legacy/unconfirmed input never receives retroactive confirmation. |
| Recorded volume | Explicit volume mode is recorded; other origins remain labeled Saved volume. | Preserve raw precision. If confirmed markings/calibration disagree with saved volume, suppress volume and show a review link; both source facts remain untouched. |
| Doses taken | Today loads taken injection_logs (compound_id, taken, date) before rendering Hero; compounds.doses_taken_override is the separate saved counter. Recorded but logs were previously ignored. | Count valid distinct taken dates for this compound through today as N logged. Never claim complete lifetime history or add the override. Counter discrepancy is disclosed. Without logs, a valid saved integer counter is N recorded; absent/invalid sources are Not established, never invented zero. |
| Next dose | Existing currentPhase and isDueToday, which WeeklySchedule also uses. Complete saved timing is derivable; frequency-only weekly plans are ambiguous. | Require valid start, active protocol, unambiguous phase and complete weekdays/rolling schedule. Use existing scheduler and skip taken dates. No last-log gap guesses or weekly fallback dates. Incomplete timing: Schedule not set. |
| Stock | Compound vials_in_stock. Recorded or missing. | Show valid nonnegative integer stock, including explicit zero; hide unknown/invalid count. |

Both Heroes share the same facts and use centered headings, artwork and responsive visible facts. Removed duplicate start/week/syringe/unknown rows and the primary-facts disclosure. About these details retains provenance and explanations. New Vial uses its unchanged restricted dialog via an action-only presentation. Premium artwork, Today action implementation, identity, ownership, saves and shared calculation/scheduling functions are unchanged.

### Validation

- 65 focused tests passed, 0 failed/skipped: protocol-preparation-presentation, vial-safety and today-v2. Added exact owner scenario, U-40, invalid/unconfirmed/unsupported inputs, volume conflicts across known modes, count sources/deduplication, incomplete schedules and phase-boundary tests. Existing inventory-expiration, legacy provenance and Today action tests remain passing.
- Supervised Hero-only browser PASS: both variants, 320/375/390/402px, light/dark, centered heading/artwork, visible primary facts, no overflow/clipped controls, reduced motion, New Vial restriction, immutable synthetic payload, conflict/missing/unsupported cases and deterministic dates.
- Existing supervised creation browser PASS: creation -> canonical payload -> JSON reload -> Detail/both Heroes, calibration, ready/mixed conflicts, keyboard/error focus and all stage width checks. Synthetic only; no production persistence certification.
- Standalone TypeScript PASS (3.5s); optimized build PASS (30.1s, 38 static pages). Direct diff whitespace check PASS. No broad regression.
- Final inspected Hero screenshots: C:\Users\three\AppData\Local\Temp\mpp-v2a-rtW32t\evidence (final-hero-light-320.png, final-hero-dark-390.png, final-hero-full-light-320.png and the remaining width/theme matrix).
- Integration evidence: C:\Users\three\AppData\Local\Temp\mpp-v2a-cbjI1l\evidence.
- Logs: %TEMP%/mpp-final-hero-focused.log, mpp-final-hero-browser.log, mpp-final-hero-integration.log, mpp-final-hero-types.log, mpp-final-hero-build.log.

Changed files (10):
- components/dashboard/HeroProtocolCard.module.css
- components/dashboard/HeroProtocolCard.tsx
- components/dashboard/VialInventory.tsx
- components/today/SelectedProtocolSnapshot.tsx
- lib/health/heroPresentation.ts (new, read-only Hero selectors)
- tests/protocol-creation-v2a.browser.cjs
- tests/protocol-preparation-presentation.test.mjs
- tests/today-v2.test.mjs
- tests/vial-safety.test.mjs
- docs/tasks/protocol-creation-v2a.md

Limitations: logged counts represent available history, not certified lifetime totals. Unlinked inventory expiration is not reassigned to a compound. Physical iPhone/Safari recheck remains; no known scoped implementation defect. To rerun only the Hero fixture, set MPP_HERO_ONLY=1 for npm run validate:browser -- tests/protocol-creation-v2a.browser.cjs. Remove that process-local variable for the full creation fixture.

Recommendation: READY FOR FINAL HERO REVIEW.
