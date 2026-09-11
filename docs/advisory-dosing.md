# Advisory dosing: save what is known

This release replaces mandatory V1 interpretation in the editor and quick-create save paths. Apply `supabase/migrations/202609100001_advisory_dosing.sql` before deploying the accompanying application. Keep the previously applied migration unchanged. No migration has been applied to live Supabase by this work.

## Persistence

`phases.dosing_entry` is a nullable JSONB object, version 2. It stores the selected mode, user confirmation status, medication amount/unit, injection volume, syringe markings/scale, vial amount/unit, dilution volume, explicit concentration/value, free-text vial label, and preparation type separately. Numeric entries remain strings to preserve blank and user-entered values. `review_status` represents user confirmation, not a medical confidence score.

The smallest additional storage is one phase-level object: dose varies by phase, and incomplete compound preparation details must survive without violating the old concentration-pair constraint. Calculated equivalents and incomplete/calculated/unverified interpretation status are derived deterministically by the shared helper on read, rather than persisting potentially stale calculated copies. Existing `phases.dose`, `dose_unit`, semantic version, administration fields, and compound preparation columns remain unchanged by V2 saves. The new entry takes display precedence. New V2 phases leave legacy dose/unit NULL, so the migration relaxes those columns' NOT NULL requirement if present. It changes no existing values.

The migration replaces the existing validation trigger function to accept validated raw entries without V1 medication-dose confirmation. It creates an authenticated, ownership-checked `save_protocol_dosing_v2` RPC. It retains the existing V1 function for old V1 records. The new RPC writes raw entry, phase schedule, and explicit protocol edits transactionally. Invalid numbers/dates/IDs and cross-user writes fail and roll back. No conversions are attempted by that save function. Raw entries cannot silently overwrite historical medication columns, and the older V1 write path cannot overwrite a V2 entry.

No schema backfill, automatic historical rewrite, compound-name lookup, or IU-to-mass assumption is included. Only an explicit user save creates/changes a raw entry. Deploying or opening an old record changes nothing.

## User flow

The editor offers Medication dose, Syringe markings, Injection volume, and I'm not sure. Legacy unreviewed phases open in I'm not sure with the original dose/unit displayed as unverified. Leaving them unclassified does not block saving. Reopening preserves every raw field and allows later classification.

Syringe markings require no concentration to save. A selected positive scale allows liquid-volume calculation. Valid medication concentration allows medication-dose calculation. Without scale/preparation data, entered markings still display with guidance. Volume-only entries behave similarly. Explicit medication mg/mcg/IU remains medication; incompatible concentration units yield a warning without conversion. Zero amounts can be recorded, but negative/non-numeric inputs and zero scale cannot. Blank concentration, dilution, medication amount, review confirmation, reconstitution date, and schedule are allowed. Missing reconstitution dates no longer default to today.

I'm not sure preserves vial-label text without parsing or inventing its meaning. It provides structured preparation/markings/scale inputs and optional math. A derived medication candidate from uncertain input is promoted only after confirmation. The help disclosure distinguishes mass, volume, syringe markings and medication International Units, including the 18 U-100 units = 0.18 mL example.

`calculateDosing` remains strict for callers that explicitly need complete calculations and existing tests. It is no longer called by normal editor/quick-create saves. `entryFromForm` validates raw input, while `interpretEntry` supplies optional equivalents and guidance. Save success shows a non-blocking notice. Calculations never silently swallow interpretation problems; warnings appear in the preview and dose displays.

## Displays

Current protocol cards and Timeline baseline use the latest raw entry when present, before legacy canonical columns. Known medication appears first; otherwise known markings or mL appear with “Medication dose not calculated.” Unknown historical units are explicitly unverified. Today's/tomorrow's scheduled rows use the same display helper. Phase expiration remains separate: no current phase means no invented dose. Inventory uses administration volume only when calculable and uses saved preparation inputs; it does not assume U-100. CSV medication fields use calculated medication values for V2 entries and mark uncalculated values instead of exporting stale legacy dose columns. Historical source event descriptions remain untouched.

## Validation and limitations

- 46 tests passed: V1 regressions, Timeline display precedence, mg/mcg/IU, complete/incomplete syringe input, volume-only input, unknown legacy entries, uncertain calculation confirmation, warnings for mass/IU mismatch, and invalid-input rejection.
- A disposable PGlite integration test applies the new migration twice, including a schema with previously NOT NULL dose fields. It verifies raw saves for incomplete/mismatched cases, preservation of historical 50 IU columns, rollback, and cross-user denial.
- TypeScript passes. Production build passes with disposable Supabase/VAPID values. This environment needed its system TLS certificates enabled for the existing Google Fonts fetch; no font/layout configuration was changed.
- No browser interaction against live production was performed. No live records were accessed or altered.
- Label text alone is not parsed into concentration. Missing syringe scale, incompatible medication/concentration units, and incomplete preparation remain warnings until clarified. Existing overlapping/expired phases may still have no unique current phase, without preventing storage of raw dosing.
- A client using only legacy dose columns must be updated to prefer `dosing_entry`; this release updates the app's protocol dosing displays, Timeline baseline and CSV medication fields. This JSON object is not a full change-audit log: subsequent explicit saves replace its current contents.

## Changed files

- `lib/health/dosingEntry.ts`: raw input validation, optional interpretation, rehydration, display and quick-create adapters.
- `app/protocol/manage/page.tsx`: four input modes, non-blocking save, help, guidance, raw rehydration and optional confirmation.
- `app/api/create-protocol/route.ts`: non-blocking quick-create adapter and V2 RPC.
- `app/protocol/page.tsx`: loads raw entries, scheduled dose display and export precedence; preserves blank quick-create inputs.
- `components/dashboard/HeroProtocolCard.tsx`: dose/warning display and deterministic administration volume.
- `components/dashboard/VialInventory.tsx`: raw-aware dose display with existing color tokens.
- `lib/health/timeline.ts`, `lib/health/loadTimeline.ts`: raw entry loading and baseline dose display precedence.
- `supabase/migrations/202609100001_advisory_dosing.sql`: additive raw storage, nullable dose compatibility, trigger update and V2 save function.
- `tests/dosing-entry.test.mjs`, `tests/timeline.test.ts`: advisory/save/display regressions.
- `docs/advisory-dosing.md`: model, rollout and validation report.
