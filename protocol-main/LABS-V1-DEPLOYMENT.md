# Labs V1

## Deploy in this order

1. In the production Supabase project, run the complete contents of `supabase/migrations/202609120001_labs_v1.sql` using SQL Editor, or apply it through your existing Supabase migration workflow. This is the only new migration. Do not rerun older dosing migrations just for this release.
2. If the migration reports an incompatible existing Labs column, stop and inspect it. Do not change its type or remove the guard to make the migration pass.
3. Copy the ZIP source into your existing repository and deploy through your usual GitHub/hosting workflow. Keep your existing environment settings. No new production environment variables or dependencies are required.
4. Open Health. Confirm that Labs loads and Journal history remains available. Test manual entry using values from a report you actually want to store. Check the Review screen carefully: saved panels are read-only in V1.
5. Open Timeline and select Labs. Confirm the panel appears on its test date and View panel opens the matching record.

The migration was tested in an isolated PostgreSQL-compatible PGlite instance. It has not been applied to your live Supabase database by this implementation. New application code gracefully reports unavailable Labs if the migration is missing; existing protocol/journal Timeline history still loads.

## Schema and security

New `lab_panels`: UUID ID and owner, test date, optional name/provider/notes, manual source type, created/updated timestamps.

New `lab_results`: UUID ID, parent panel and owner, biomarker name, optional canonical name/category, numeric value OR verbatim text value, unit, optional numeric reference bounds and reference text, status and status source, created/updated timestamps. Qualitative/comparator results such as “Not detected” or “<5” remain text and are not plotted as numeric measurements.

Both tables use authenticated owner-scoped SELECT/INSERT RLS. A composite parent/owner foreign key prevents attaching results to another user's panel. Anonymous clients have no read/save privileges. There are no client UPDATE or DELETE privileges or policies in V1. Account deletion cascades only to the account's new lab records.

`save_lab_panel_v1` is SECURITY INVOKER. It gets ownership from `auth.uid()`, not a client-supplied ID, and saves the panel plus 1–500 results atomically. A failed result rolls back the entire panel. Database constraints independently reject missing results, nonfinite numeric values, invalid ranges, and invalid statuses. A trigger derives status only when it is not explicitly reported by the lab.

The migration is transaction-wrapped. Tables/indexes use IF NOT EXISTS; functions/triggers are replaceable; policies are guarded against duplicate creation. Existing column types are checked without conversion. Migration reruns were tested with populated lab tables and preserved rows/timestamps. No UPDATE, DELETE, backfill, or historical protocol/journal mutation is performed by the migration. No dosing tables are altered.

## Status rules

- Explicit lab status is preserved, including Normal, Abnormal or Unknown, even if it differs from an entered numeric range.
- Otherwise, a numeric value with inclusive numeric bounds yields Low, Normal or High. One-sided bounds are supported.
- Missing numeric bounds or nonnumeric results remain Unknown unless the user supplies the lab's status.
- Reference text is preserved. No context-dependent range or medication meaning is inferred.
- Status source is displayed as reported, numeric-bound comparison, or not supplied. Status is not a diagnosis.

## Experience

- `/health` is the new Labs landing page. The Health bottom tab now targets it; `/journal` stays intact and accessible through Journal history, and still selects the Health tab.
- Recent Panels cards show date, provider, result count and counts of high/low/abnormal values.
- Add Lab Results has three steps: panel information, biomarker rows, and review. Optional reference controls are collapsed. Rows can be added, changed, or removed before saving. Errors keep form inputs in place, and repeat clicks are blocked during save.
- Panel details show every result, reference and status. Notes are expandable.
- Biomarker Trends groups exact trimmed names across panels. Units are matched exactly after trimming and are shown separately if different. There is no synonym inference or unit conversion.
- SVG trends use actual date spacing. Charts require numeric results, a recorded shared unit and unique dates. Qualitative values, missing units and multiple readings on the same date remain in the dated list without an invented line. The latest-date display shows all ties as a count rather than arbitrarily selecting a result.
- Timeline gets one concise event per panel, ordered by test date. Existing protocol/journal events retain their normalization and ordering. Large panels show a count summary rather than dozens of rows. Labs filtering is functional and View panel opens `/health?panel=...`.
- User-scoped panel and result queries are batched separately, avoiding N+1 requests and nested-result caps.
- Mobile layout reuses existing tokens, safe-area app shell, 44px+ controls, 16px inputs, wrapping result cards, two-column form fields where space permits, and a sticky review/save bar above the tab bar. Desktop remains centered at 760px maximum width.
- Status badges have symbols and text, not color alone. Fields have labels, filters retain aria-pressed, errors/statuses are announced, focus outlines remain visible, and disclosures use native details/summary.

## Exact files

Added:
- `app/health/page.tsx`
- `app/health/health.module.css`
- `components/health/HealthDashboard.tsx`
- `components/health/AddLabForm.tsx`
- `components/health/LabPanelCard.tsx`
- `components/health/LabResultRow.tsx`
- `components/health/LabStatusBadge.tsx`
- `components/health/BiomarkerTrend.tsx`
- `components/timeline/LabTimelineEvent.tsx`
- `lib/health/labs.ts`
- `lib/health/loadLabs.ts`
- `lib/health/labTimeline.ts`
- `supabase/migrations/202609120001_labs_v1.sql`
- `tests/labs.test.mjs`
- `tests/labs-migration.test.mjs`
- `LABS-V1-DEPLOYMENT.md`

Modified:
- `components/app/BottomTabBar.tsx`: Health target only.
- `lib/tabs.ts`: recognize Health and retain journal highlighting.
- `lib/health/timeline.ts`: add Labs category and lab_panels source type only.
- `lib/health/loadTimeline.ts`: load/merge labs; surface partial Labs failures separately.
- `app/timeline/page.tsx`: display Labs loading failure/retry without hiding other history.
- `components/timeline/TimelineHistory.tsx`: delegate Labs events to their component.
- `components/timeline/TimelineEmpty.tsx`: replace Labs-coming-soon with manual-entry link.
- `tests/timeline-ui.test.mjs`: update the Labs empty-state expectation.

## Validation

- TypeScript: passed (`npx tsc --noEmit` and build typecheck).
- Focused ESLint on new and modified application/test files: passed.
- Regression suite: 91 tests, 90 passed, 1 optional existing dosing SQL test skipped. No failures.
- New Labs coverage: 15 passing tests including SQL subtests. Covers multi-result creation, normal/high/low, unknown, explicit abnormal, qualitative results, validation, exact-name trends, unit mismatch, concise Timeline events, Labs filtering, owner-scoped reads, transactional save calls, actual RLS denial, rollback, anonymous access, and migration reruns with preserved records.
- Production build: passed, including `/health`. Build used temporary local-only test configuration. No live credentials or production data were used. Existing edge-runtime static-generation notice remains.
- Browser verification was attempted but unavailable: the runtime lacked Chromium and its download endpoint failed. Mobile/device behavior has not been browser-verified.

Run ordinary tests with `node --test tests/labs.test.mjs tests/timeline-ui.test.mjs tests/timeline.test.ts`.
SQL integration tests use an optional external PGlite installation. Set `LABS_PGLITE_PATH` to its absolute `dist/index.js` path and run `node --test tests/labs-migration.test.mjs`. No PGlite dependency was added to production.

## Remaining limitations

- Saved panels are read-only. Verify entries before saving; saved-panel correction/deletion UI is deferred.
- A network interruption can leave save confirmation uncertain even if the transaction committed. The error asks the user to check Recent Panels before retrying. No automatic retry or silent duplicate repair is performed.
- Drafts are held in the current form, not persisted across browser refreshes.
- Very large histories retain batched full-history loading. Pagination/virtualization can follow measured usage.
- A real mobile Safari pass remains necessary for keyboard, scrolling, disclosures and sticky actions.

## Deferred to Labs V2

PDF/CSV import, OCR, Function Health/external connectors, Apple Health, AI interpretation, doctor reports, protocol overlays, causal claims, PK modeling, synonym mapping, unit normalization, and saved-panel edit/delete workflows. None of these are included in this release.
