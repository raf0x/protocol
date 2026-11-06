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

## Targeted UX corrections — 2026-11-05

The independent review approved preview preparation. This correction addresses its UX findings; the correction itself awaits independent recheck.

Correction-only files (7): `components/protocols/CreationMeasurement.tsx`, `components/protocols/ProtocolQuickStart.tsx`, `lib/protocols/quickStart.ts`, `tests/protocol-creation-v2a.test.mjs`, `tests/protocol-creation-v2a-sql.test.mjs`, `tests/protocol-creation-v2a.browser.cjs`, and this report. The complete V2A worktree still contains 14 changed files against the unchanged baseline HEAD.

- Reproduced the negative vial amount advancing to Measurement with a failing UI test. Preparation amounts now validate independently at their own fields, including when a measurement is also invalid. Save returns preparation errors to Preparation. Retained invalid fields are exposed for correction without discarding facts or changing preparation semantics.
- Reused existing amount/error controls for field IDs, `aria-invalid`, and `aria-describedby`; mode/calibration groups have associated errors. Validation focuses the offending control and opens its disclosure, including repeated Continue attempts. Duplicate preparation/measurement summary announcements were removed.
- Review uses plain-English preparation labels. Calibration appears for syringe mode or recorded syringe facts, preserving visible saved information without adding an irrelevant unconfirmed-calibration row to ordinary medication/volume entries.
- Optional route approved locally: an empty route remains empty in the draft and becomes `null` through the unchanged canonical adapter. Existing SQL accepts it; daily, weekly and rolling schedules round-trip unchanged. `isDueToday` has no route dependency. The UI offers “Not specified” and uses existing neutral timing language. No route is inferred.

Final local verification:

- `npm run validate:focused -- tests/protocol-creation-v2a.test.mjs tests/protocol-creation-v2a-sql.test.mjs tests/protocol-quick-start.test.mjs tests/dosing-entry.test.mjs`: 65 passed, zero failed/skipped.
- `npm run validate:browser -- tests/protocol-creation-v2a.browser.cjs`: passed at 390 x 844. Covers preparation/measurement errors, focus, hidden-field disclosure, repeated submission, explicit calibration, equivalent, null route and canonical payload. Final evidence: `C:\Users\three\AppData\Local\Temp\mpp-v2a-ySQHnm\evidence`; corrected error screenshot visually inspected.
- `npm run validate:types`: passed. `npm run validate:build`: passed against final application sources; prior optimized-build evidence was not reused after source changes. `git diff --check`: passed.
- Broad regression not run. Actual iPhone/Safari and assistive-technology QA remain outstanding.

Calculation gates, final-volume arithmetic, stored values, historical records, inventory/New Vial boundaries, identity, ownership, auth, Today and database definitions were not changed by this correction. No staging, commits, pushes, deployment, production/Supabase access or App Store rebuild. Recommendation: CORRECTIONS READY FOR INDEPENDENT RECHECK.
