# Dosing Semantics V1

## Installation

Apply `supabase/migrations/202609090001_dosing_semantics_v1.sql` to a staging copy first, then deploy the matching application code. Coordinate the production migration and code deployment: older clients that insert phases without explicitly confirming V1 will be rejected by the new trigger. This migration has NOT been applied to the user's live database. It adds fields/functions/constraints only; it does not UPDATE, DELETE, backfill, or merge existing user records.

The repository does not contain the original schema DDL. The migration was tested against a PostgreSQL-compatible fixture of the existing tables/fields used by the app. Verify against the actual schema, RLS policies, and grants in staging before production deployment.

## Field contract

| Concept | Canonical fields | Meaning |
| --- | --- | --- |
| Medication dose | `phases.dose`, `phases.dose_unit` | Positive administered amount, unit mg, mcg, or medication IU only |
| Review/version | `phases.dose_semantics_version` (new) | 1 for explicitly confirmed V1 writes; NULL for unreviewed existing rows |
| Vial amount | `compounds.vial_strength`, `compounds.vial_unit` | Total medication amount in a vial, unchanged |
| Reconstitution volume | `compounds.bac_water_ml` | mL of reconstitution volume, unchanged |
| Concentration | `compounds.concentration_value`, `concentration_unit` (new) | Positive mg/mL, mcg/mL, or IU/mL; persisted from label or valid reconstitution inputs |
| Phase injection volume | `phases.injection_volume_ml` (new) | Calculated mL for that phase's dose at the saved concentration |
| Syringe markings | `phases.syringe_units`, `syringe_scale` (new) | Markings and explicitly selected markings/mL (U-40 or U-100); no default scale |
| Route | `phases.route` (new) | Optional explicit IM or SubQ |
| Legacy injection volume | `compounds.ml_per_dose` | Retained unchanged for historical review; new dosing saves do not overwrite it |

The pure `calculateDosing` function exposes distinct `administeredDose`, `concentration`, `injectionVolume`, and `syringeUnits` objects. `dosingFields` maps these to persistence fields. Mass conversions between mg and mcg are supported. IU/mass conversion is rejected. No compound names influence units or conversion. Missing concentration preserves medication dose but leaves volume/markings empty.

Phase-level volume avoids one compound-level volume overwriting every phase when dose changes. Saved phase administration values are not recalculated automatically when another phase is edited. Compound concentration reflects the saved preparation, not a complete historical vial log; no historical exposure reconstruction is claimed.

## Save paths

- **Protocol manager:** medication dose/unit are explicitly labelled. Premixed label concentration is retained. Reconstituted concentration is calculated from validated vial amount and volume. An optional selected syringe scale produces separate administration fields and a visible preview. Legacy rows require a medication-dose confirmation checkbox before saving. No phase is silently confirmed by the migration.
- **Phase editor:** existing compound IDs and phase IDs are preserved. A phase selector, start-week field, duration (blank explicitly means ongoing), and Add phase action support review and extensions. Only the selected/new phase is saved; other phases are never deleted on edit. Overlapping ranges are rejected. Phase/date edits happen only after an explicit user save. Removing a saved compound requires explicit confirmation and save; the RPC receives an explicit removal list. Omitting a compound from a request never implicitly deletes it.
- **Atomic RPC:** `save_protocol_dosing_v1` saves the protocol, compound concentration, and selected/new phase together. It recalculates volume/markings server-side, validates units, checks authenticated ownership and overlapping ranges, uses invoker RLS, and rolls the entire operation back on failure. Client-supplied calculated volume is not trusted.
- **Quick create:** `/api/create-protocol` requires validated `dose_unit` and `vial_unit` with amount inputs, supports mg/mcg/IU, and uses the atomic RPC. No unconditional mg assignment remains in that API. Optional explicit concentration is supported. The Dashboard's quick-create form submits selected units to that API. Existing demo creation has explicitly defined medication units and marks only newly created demo phases as V1.
- **Inventory dosing wizard:** the old volume-only writer was removed. Its replacement opens the shared protocol/phase editor for that compound. Medication, concentration, volume and markings are saved together there. Reviewed current-phase administration is shown separately; old compound volume is labelled legacy. New vial lifecycle changes remain available; changing strength or dilution routes to the shared dosing editor rather than silently leaving an inconsistent concentration.
- **Standalone reconstitution calculator:** remains an explicitly mass-labelled calculator. U-100 markings require an explicit U-100 checkbox. Save-to-protocol carries the dose, vial, dilution, units, and selected scale into the shared editor; values are not silently lost.

## Reads and expiration

Baseline medication dose comes only from exactly one current phase with `dose_semantics_version=1`. Its schedule remains structured, and route is shown only if stored. Missing, future, overlapping, or expired phases show a review/add/extend link. There is no last-phase fallback. Legacy phases show a review warning, never guessed doses. The dashboard's medication badges and today's/tomorrow's dose lists follow the same rule. The weekly calendar no longer continues a first phase outside its range. Logging/history is not deleted by these changes.

Historical protocol descriptions remain source text. Saved-plan enrichment is withheld for unreviewed legacy phases. Existing journal/weight behavior, Timeline route and filters, authentication proxy, and Labs empty state are unchanged.

## Manual correction report: exported records

These are separate records, not inferred duplicates. No correction was performed.

| Record | Exported issue | Required manual decision |
| --- | --- | --- |
| TRT, start 2026-05-18, protocol `df6dba32-aba0-4650-a59e-0c8fda70bcb1` | 75 mg phase ends week 10; concentration missing; legacy volume 0.5 mL | Verify current medication amount and labelled concentration independently; explicitly add/extend a phase if ongoing. Do not derive concentration from a possibly outdated dose/volume pair. |
| HCG, start 2026-04-20, protocol `51624dbd-6b3a-491c-898d-12847e9c2b2e` | Vial unit stored as mg, phase uses ambiguous 10 IU, phase expired | Verify vial label and medication dose; correct the vial unit only after verification; explicitly define current phase and scale. |
| HCG, start 2026-06-09, protocol `295d84d3-e04d-4865-b215-5b438c763881` | IU-labelled vial, phase dose 10 IU could mean medication or syringe markings | Confirm medication IU separately from syringe markings. The existing values cannot establish the intended semantics. |
| HCG, start 2026-05-25, protocol `28d6caf5-eb4c-4916-ae39-d217650a876c` | 5 mg vial / 200 mL / expired 1 mg phase still marked active | Review each amount, unit, phase dates, and status; do not merge with other HCG records by name. |

All pre-migration phase records, including seemingly plausible mg/mcg records, remain unreviewed until explicitly confirmed. No global unit replacement, phase extension, or active-status correction is included.

## Validation commands

- `node --test tests/dosing.test.ts tests/timeline.test.ts` (Node 24)
- `DOSING_PGLITE_PATH=/absolute/path/to/@electric-sql/pglite/dist/index.js node --test tests/dosing-migration.test.mjs`
- `npm run lint`
- `npm run build` (requires existing Supabase and VAPID environment configuration)

The database test uses a disposable local engine, not live Supabase. It checks legacy preservation, authenticated atomic saves, separate dose/concentration/volume/markings, incompatible unit rejection, rollback, and cross-user denial. PGlite is a validation-only tool, not an application dependency. The test explicitly skips if its path is not supplied.

## Implementation validation results

20 dosing/Timeline tests and one database integration test passed. Production build passed with disposable build-time Supabase/VAPID configuration. TypeScript and focused lint passed. Full repository lint reports 513 errors and 77 warnings (baseline: 520 errors and 79 warnings); comparison found no introduced lint findings. Browser smoke testing could not run because the browser binary was unavailable and its download failed. No live database was accessed or migrated.

## Changed files

- `app/api/create-protocol/route.ts`
- `app/calculator/page.tsx`
- `app/protocol/manage/page.tsx`
- `app/protocol/page.tsx`
- `app/timeline/page.tsx`
- `components/dashboard/HeroProtocolCard.tsx`
- `components/dashboard/VialInventory.tsx`
- `components/dashboard/WeeklySchedule.tsx`
- `docs/dosing-semantics-v1.md`
- `docs/timeline.md`
- `lib/health/dosing.ts`
- `lib/health/loadTimeline.ts`
- `lib/health/timeline.ts`
- `supabase/migrations/202609090001_dosing_semantics_v1.sql`
- `tests/dosing-migration.test.mjs`
- `tests/dosing.test.ts`
- `tests/timeline.test.ts`

## Production schema compatibility correction

The initial migration assumed these columns were absent. A production failure confirmed that `phases.syringe_units` already exists. This revision does not claim to have inspected the remote catalog: no live schema connection or authoritative schema dump was available.

Only the migration, `tests/dosing-migration.test.mjs`, and this document changed in this correction. Application code and RPC save behavior are unchanged.

### Field inspection

| Field | Repository evidence | Production conclusion |
| --- | --- | --- |
| `compounds.concentration_value` | V1 migration, shared calculation, editor and RPC | Existence/type not confirmed remotely; checked before DDL |
| `compounds.concentration_unit` | V1 migration, shared calculation, editor and RPC | Existence/type not confirmed remotely; checked before DDL |
| `phases.dose_semantics_version` | V1 migration and reviewed-dose reads/writes | Existence/type/default not confirmed remotely; checked before DDL |
| `phases.injection_volume_ml` | V1 migration and separate administration fields | Existence/type not confirmed remotely; checked before DDL |
| `phases.syringe_units` | Predates V1: `write-protocol-rebuild.js`, `fix-phase-simple.js`, `fix-calc-bridge.js` | Confirmed present by production error, exact type not supplied |
| `phases.syringe_scale` | V1 migration and explicit scale selection | Existence/type not confirmed remotely; checked before DDL |
| `phases.route` | V1 migration and optional route selection | Existence/type not confirmed remotely; checked before DDL |

Older scripts labelled `syringe_units` as syringe markings and saved it separately from medication dose and `volume_ml`. This is consistent with the intended concept, but historical scales and individual values cannot be certified. Some older displays labelled computed markings “IU”, adding ambiguity. The migration preserves all such values. Only explicitly reviewed V1 phases enforce the markings/volume/scale relationship. No legacy `volume_ml` is renamed, copied, or removed, and no U-100 scale is inferred.

### Migration safeguards

- Every one of the seven columns uses `ADD COLUMN IF NOT EXISTS`.
- Before any additions, existing definitions are checked against nullable, no-default `numeric`, `text`, or `smallint` as specified. Generated/identity columns, alternate types (including constrained numeric precision), defaults, and NOT NULL definitions cause an explanatory exception. No casts or column alterations are attempted. This conservative guard can stop for a potentially compatible but unverified definition; inspect it rather than removing the guard blindly.
- Constraints are added only when absent. Existing same-name constraints must match the canonical expected definition; a collision aborts rather than dropping or replacing an unknown constraint.
- New checks use `NOT VALID`, preserving pre-existing data without an installation-time validation scan. They still enforce new/changed rows. Phase checks exempt unreviewed rows, so old markings without a scale are not rejected. Existing invalid concentration pairs remain stored, but editing those compound rows requires valid concentration inputs.
- Both functions use `CREATE OR REPLACE FUNCTION`; the trigger uses `CREATE OR REPLACE TRIGGER` (PostgreSQL 14+). Incompatible function signatures/return types fail transactionally instead of being dropped.
- All work remains inside `BEGIN` / `COMMIT`. No production column, constraint, or historical row is dropped or overwritten by this migration. Temporary definition-comparison tables contain no user rows and disappear at commit.
- No data UPDATE, DELETE, or backfill was added to migration execution. The existing save RPC body still defines user-initiated writes, unchanged from V1; defining that function does not execute its writes.

### Retry and diagnostics

Replace the failed `202609090001_dosing_semantics_v1.sql` file with this version, keeping its migration identifier. If Supabase still lists it as pending, retry `npx supabase db push`. Do not mark a failed migration as applied. If it is already recorded as successfully applied, stop and reconcile that state before changing migration history. This correction intentionally stops if an older same-name constraint has a different definition.

If the compatibility check stops, inspect the following read-only catalog output before attempting any changes:

```sql
SELECT table_name, column_name, data_type, udt_name, numeric_precision,
       numeric_scale, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'compounds' AND column_name IN
        ('concentration_value', 'concentration_unit'))
    OR (table_name = 'phases' AND column_name IN
        ('dose_semantics_version', 'injection_volume_ml', 'syringe_units',
         'syringe_scale', 'route', 'volume_ml')))
ORDER BY table_name, ordinal_position;
```

### Correction validation

Six database scenarios passed: fresh schema, pre-existing syringe column, all seven columns already present, incompatible type, incompatible default, and conflicting constraint. Successful cases apply the migration twice and verify one trigger, unchanged historical values, authenticated saves, correct dose units, and transaction isolation. Failure cases verify rollback without historical or partial schema changes. Validation uses a disposable PGlite database, not production.

The 20 dosing/Timeline tests, TypeScript (`npx tsc --noEmit`), and production build also passed for this correction. Build used disposable Supabase/VAPID configuration. No application behavior or dependencies changed.

## Existing-phase syringe review correction

The exact message `Medication IU cannot be converted to or from mass units.` originates in `calculateDosing` (`lib/health/dosing.ts`). Existing editor `startEdit` and phase selection previously forced medication input mode while preserving a legacy IU label. `save` called `dosingFields` on those values before the RPC. Selecting syringe mode did not transfer the stored amount into the separate markings field. This left a reproducible legacy-state failure despite the earlier new-entry conversion support. Live browser state was not available: if syringe mode was correctly selected and filled, another compound in the same all-compound save could also have produced this error.

The existing edit path is `/protocol/manage` -> `save` -> shared editor input adapter -> `dosingFields` -> `calculateDosing` -> Supabase `save_protocol_dosing_v1`. No Next API transformation occurs. `/api/create-protocol` handles quick creation only. SQL rejects incompatible medication units with a different message, and the V1 trigger enforces confirmation rather than performing conversions. Neither required modification.

Unreviewed phases now load with no selected meaning, both on initial edit and phase selection. The UI asks “This value represents” and displays the original value explicitly as unverified. Choosing “Syringe marking” copies that value only after the user's action, requires a scale, and derives medication dose from valid preparation data. Preview and save share `editorDosingInput`. Confirmation is reset on interpretation/preparation edits; conversion failures are visible in the preview and save errors identify the compound. No historical rows are changed by deployment or page loading.

Corrected payloads retain the compound and phase IDs. `phase.dose`/`dose_unit` contain the calculated medication amount/unit; `syringe_units`, `syringe_scale`, `injection_volume_ml`, and `dose_semantics_version=1` remain separate. The existing SQL function recomputes administration quantities and saves only after the explicit user save. True medication IU continues to be supported; genuine IU-to-mass requests remain rejected. No names influence interpretation.

Changed files: `app/protocol/manage/page.tsx`, `lib/health/dosing.ts`, `tests/dosing.test.ts`, `tests/dosing-migration.test.mjs`, and this document. No migration/API changes. 26 dosing/Timeline tests plus six disposable database scenarios passed. Database coverage includes correction of an existing phase via the editor adapter and RPC. TypeScript and production build passed with disposable build-time configuration. No live production records were accessed or corrected.

## Generic review selection-order correction

Inspection of the preceding version found no compound-name/category branches: both existing-phase entry points already call `phaseDosingReview`, and `editorDosingInput` rejects unresolved meaning before conversion. The exact production difference between two records cannot be established without their review version/form state. The IU-to-mass message is impossible from the valid syringe branch because its dose unit is derived from the concentration. It still intentionally occurs after an explicit incompatible medication choice, or for another compound in the all-compound save.

A reproducible state gap was fixed: choosing Medication dose before Syringe marking previously prevented the stored legacy number from transferring into markings. The review helper now retains an unpersisted `legacy_value` for every unreviewed phase. An explicit syringe choice uses that original number if the markings field is empty, regardless of prior mode selection. Entered markings are preserved across subsequent mode switches. Reviewed V1 phases retain their normal medication initialization without a new review prompt. Unclassified legacy rows no longer show medication inputs; they show the explicit existing-value review question.

No units are inferred from names. Corrected values are persisted only on explicit save, using the same separate medication/volume/markings/scale/V1 payload and existing phase ID. No API, SQL, migrations, or historical rows changed. Files changed: protocol manager, shared dosing helper, dosing tests, and this document. Thirty dosing/Timeline tests passed, covering three different mass-based fixture shapes and selection order, true IU, mg medication classification, reviewed phases, and unsupported conversion rejection. TypeScript and production build passed. Live production state was not inspected.
