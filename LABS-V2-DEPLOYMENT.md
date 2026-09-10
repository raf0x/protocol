# Labs V2A + V2B

## Deployment order

1. Keep Labs V1 installed. Run only the new `supabase/migrations/202609130001_labs_v2_edit_import.sql` in Supabase SQL Editor or your established migration workflow. Do not rerun the older V1 migration after V2: V1 intentionally resets its original privileges and manual-only schema assumptions.
2. Use Node.js 22.13+ or Node.js 24 for local/hosting builds. The pinned PDF.js dependency requires this runtime; Node.js 24 is a suitable hosting selection. No new environment variables are required.
3. Copy the ZIP contents into your existing repository, preserving your environment configuration. Run `npm install`. The postinstall script copies the version-matched PDF worker, character maps, standard fonts and license into `public/vendor/`. These assets are also included in this ZIP. If install scripts are disabled, run `node scripts/copy-pdf-worker.mjs` explicitly.
4. Run `npx tsc --noEmit` and `npm run build`, then commit/push using your existing deployment workflow. The new dependency and lockfile must be included.
5. On the deployed site, verify Health > Add / Import, manual creation, CSV mapping/review, a text-based PDF, editing, and the delete confirmation. Use only data you intend to store. Uploading alone performs no database write.

The migration has not been applied to your production database here. It was exercised in an isolated PostgreSQL-compatible PGlite database. No live health records were changed.

## Migration and security

Adds `lab_panels.source_filename` and `source_metadata`, plus `lab_results.source_row_index`, `source_raw`, and `import_confidence`. Adds guarded constraints and type checks. Extends the known V1 source-type check from manual-only to manual/csv/pdf without rewriting rows. Existing `value`/`value_text` already support quantitative, qualitative and comparator results; no value-column migration is necessary.

Owner-scoped UPDATE and DELETE RLS policies extend the existing SELECT/INSERT policies. Ownership is verified against `auth.uid()`. Composite panel/owner foreign keys remain intact. Narrow SECURITY INVOKER RPCs implement transactional create/import/edit and version-checked deletion. Anonymous clients have no execution grant.

`save_lab_panel_v2` checks the parent owner and expected `updated_at`, locks an edited panel, validates existing result IDs belong to that panel, updates retained results in place, adds new rows and removes omitted rows atomically. A later invalid row rolls back earlier changes. New imports require explicit panel and row review flags. No client user ID is used to assign ownership.

`delete_lab_panel_v2` checks owner and expected version. Existing foreign-key cascade deletes only that panel's results. UI confirmation explicitly states this permanent effect. Stale versions or failures do not claim success.

Audit triggers preserve `created_at`, stable IDs, parent ownership and original import provenance on updates, while advancing `updated_at`. Result status still uses the V1 reported/derived/unknown rules. The migration itself performs no historical data update/delete or backfill; UPDATE/DELETE statements inside RPC bodies execute only when called by an authorized user. Only Labs tables/functions/policies are changed.

Columns use ADD COLUMN IF NOT EXISTS; constraints/policies are guarded; functions/triggers are replaceable. Reruns with populated tables preserve records and timestamps. Incompatible pre-existing column types fail rather than being converted.

## User experience

Health retains its existing route and navigation. A compact Add / Import disclosure offers Add manually, Import CSV and Import PDF. Panel details now include Edit panel, Delete panel, and expandable original provenance.

Editing reuses the existing three-step form. Users can change panel date/name/provider/notes, edit results, add results and remove results. IDs and creation timestamps are retained for existing rows. Results remain deterministically sorted by name and ID on reload.

Deletion uses a native confirmation dialog with Keep panel initially focused, disabled controls while pending, and explicit failure text. There is no deletion on opening the dialog. The related Timeline event disappears because Timeline reads current panels, rather than storing a duplicate lab event record. Edited test dates determine the event's new chronological position.

## CSV import

CSV is decoded locally, supporting UTF-8 and BOM-marked UTF-16. Parsing handles BOM, comma/tab/semicolon delimiters, quoted commas, escaped quotes, CRLF and multiline cells. Header matching ignores spacing/punctuation/case and recognizes common aliases for biomarker/result/unit/reference/bounds/flag/date/provider/panel.

The mapping screen preselects detected fields and permits manual remapping. No change is required when detection is correct. A CSV column cannot be assigned to multiple fields. Original headers and cells remain in row provenance.

Missing optional columns are allowed. Missing required row values or unclear columns receive warnings. ISO dates are recognized; ambiguous date spellings require manual selection. Files with multiple dates/providers/panel names warn the user instead of silently choosing the first. V2 imports one panel at a time; exclude unrelated rows or split the file.

## PDF import

PDF.js is loaded only for PDF import. It extracts embedded text locally using page coordinates, a same-origin versioned worker, bundled fonts and character maps. No original PDF bytes are uploaded or stored in the database. No external PDF service, rendering/OCR pipeline, document JavaScript execution or AI call is introduced.

A generic parser proposes likely result lines. An adapter interface supports later provider layouts, with generic fallback when no adapter recognizes a report. No provider-specific adapter or brand-specific behavior is installed in V2. Generic PDF rows are deliberately marked medium or low confidence, never automatically trusted.

Users supply/verify PDF date, provider and panel name. Extracted text is available for checking missed rows; original page/line text is preserved with candidates. Empty/scanned, unsupported and password-protected PDFs show actionable messages. OCR is explicitly deferred.

Reference: [Mozilla PDF.js examples](https://mozilla.github.io/pdf.js/examples/). Dependency pinned to `pdfjs-dist` 6.3.289, with its license included.

## Mandatory review, duplicates and provenance

Both formats feed the shared form: panel information > editable rows > final review. Rows have Include controls, parser confidence/warnings and original-source disclosure. Users can correct fields, exclude/remove candidates and add missing biomarkers. Final imported saves require the explicit checkbox confirming included rows, dates, units, warnings and duplicates. Changes made by going Back require confirmation again. No upload or parsing action saves data.

Possible duplicates match the same test date, exact trimmed biomarker name, value and unit against the user's loaded panels and other included draft rows. Numeric spellings such as 12 and 12.0 match the same stored value. Text values and units are not converted or medically normalized. Duplicate rows remain included unless the user excludes/removes them; the final review reiterates duplicate warnings before the user chooses to keep them.

Confirmed CSV rows preserve original cells and header context. PDF candidates preserve page and raw text; panel metadata retains extracted text, parser version and review timestamp. Excluded rows are not saved as results. The original PDF binary is not stored. Original provenance remains unchanged after manual corrections, so the source and corrected value can be compared.

Recognized explicit lab flags H/L/N/A and their exact label equivalents retain their reported meaning. Unrecognized flags remain visible in raw source with warnings; Positive is not inferred to mean Abnormal. Only inclusive numeric ranges become numeric bounds. Strict or context-dependent ranges remain reference text. Units are unchanged, and existing same-unit trend separation is preserved.

## Limits and accessibility

- At most 500 saved results per panel, 2 MB CSV, 10 MB PDF, 50 PDF pages, 200,000 extracted characters and 10,000 extracted lines. PDF extraction has a timeout. Split larger reports.
- Uses existing mobile tokens, wrapping cards, 44px+ controls and sticky review/save actions above the safe-area tab bar. No desktop-style import tables.
- Native labeled file/select/input controls, Include and final confirmation checkboxes, warning text in addition to color, visible focus, and native dialog/summary keyboard behavior.
- Parser confidence describes extraction certainty, not clinical confidence. Generic parsing can miss or misalign rows. Review against the original report remains necessary.
- Drafts live in form memory. Refresh/navigation discards an unsaved draft. A connection interruption can leave save confirmation uncertain; check existing panels before retrying. No automatic duplicate repair or retry is performed.
- No browser/device verification was claimed. Chromium was unavailable in this workspace; extraction was tested against actual in-memory PDFs through the installed engine.

## Files

Modified source:
- `package.json`, `package-lock.json`: pinned PDF.js dependency and postinstall worker setup.
- `lib/health/labs.ts`: optional provenance and draft fields only; existing value/status/trend rules retained.
- `lib/health/loadLabs.ts`: authenticated V2 save and delete helpers; V1 helper retained for compatibility.
- `components/health/AddLabForm.tsx`: shared add/edit/import review, inclusion, duplicates and confirmation.
- `components/health/HealthDashboard.tsx`: Add / Import menu, edit/delete/provenance routes and actions.
- `app/health/health.module.css`: import controls, raw-source disclosure and delete dialog.

Added source:
- `lib/health/labImport.ts`: CSV parsing/mapping, reference/flag handling and generic PDF parser/adapter interface.
- `lib/health/pdfImport.ts`: bounded embedded-text extraction.
- `lib/health/labEditor.ts`: edit initialization, import payload review and duplicate warnings.
- `components/health/ImportLabForm.tsx`: local file extraction/mapping UI.
- `components/health/DeleteLabPanel.tsx`: explicit confirmation dialog.
- `scripts/copy-pdf-worker.mjs`: versioned PDF static assets.
- `supabase/migrations/202609130001_labs_v2_edit_import.sql`.
- `tests/labs-v2.test.mjs`, `tests/labs-v2-migration.test.mjs`.
- `LABS-V2-DEPLOYMENT.md`, `LABS-V2-FILES.txt`.
- `public/vendor/`: PDF.js worker, font/character-map assets and license. Individual asset paths are listed in `LABS-V2-FILES.txt`.

No Today, Protocols, dosing, phase, authentication, Timeline normalization or unrelated API changes.

## Validation

- Full regression suite: 123 tests, 122 passed, one existing optional dosing SQL test skipped. No failures.
- New V2 tests: 32 passing tests including SQL subtests. Covers edit/add/remove/delete, stale-write handling, cross-user denials, immutable creation/source metadata, timestamp updates, rollback, reruns, CSV shapes/mapping/qualitative values/ranges/flags/duplicates, review enforcement, adapter fallback, actual text-PDF extraction, scanned/invalid PDF rejection, units, Timeline date/deletion derivation and compact large-panel summaries.
- The first SQL run had a test-only date-object/string mismatch; the assertion was corrected and the suite rerun successfully.
- Standalone TypeScript: passed.
- Focused lint on changed application code, setup script and new tests: passed.
- Production build: passed using temporary nonproduction configuration. No actual Supabase access or record writes were needed for build validation.

Run pure/parser tests: `node --test tests/labs-v2.test.mjs`.
Run SQL tests: set `LABS_PGLITE_PATH` to an installed PGlite `dist/index.js`, then `node --test tests/labs-v2-migration.test.mjs`. PGlite is a test-only external installation and is not added to the app dependencies.

## Deferred to Labs V2C / V3

OCR, automatic unit normalization/conversion, biomarker ontology/categories, protocol overlays, causal analysis, AI interpretation, external lab/API integrations, provider-specific PDF adapters, automatic multi-panel splitting, file storage, persistent import drafts and a full edit audit-log UI. None are included in this release.
