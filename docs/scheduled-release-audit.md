# Scheduled protocol release audit

Scope: current working tree over `b6ad8ef`; Scheduled means stored `active` with a start date after the user's local calendar day. No commit, deployment, or connected-database migration was performed.

## Consumer inventory

| Consumer | Finding / boundary |
| --- | --- |
| `app/protocol/page.tsx` configured-protocol query | Fetches stored active rows, then separates future starts before setting active protocols, generating due doses, counting missed doses, rings, or chart markers. |
| `components/today/TodayOverview.tsx`, `ActiveProtocolList`, `NextDoseFocus`, `RecentChanges` and `lib/health/today.ts` | Active list uses derived lifecycle; recent events require date <= local Today. Due/missed inputs originate from the filtered Today query. |
| `components/dashboard/CompoundRings.tsx`, `StatsBar.tsx`, `HeroProtocolCard.tsx`, `WeeklySchedule.tsx`, `InsightCards.tsx` | All take the filtered active collection from Today. Hero's continuation action additionally requires an expired phase. No Scheduled ring, current week, due dose, or missed dose. |
| `lib/utils.ts` `isDueToday`; `lib/health/dosing.ts` `currentPhase`; `lib/health/phaseLifecycle.ts` | Future starts return not due / no current phase / no expired phase. Week arithmetic compares date-only strings as dates; no pre-start schedule is generated. |
| `lib/health/protocolPresentation.ts` | Scheduled displays saved configuration, no current week or upcoming dose. |
| `app/protocol/manage/page.tsx` | The legacy variable named activeProtocols is only an input ordering bucket, not an active count; ProtocolLibrary does final lifecycle grouping. Its active-status phase-editor hint applies to editable saved configuration, not current treatment. |
| `ProtocolLibrary`, `ProtocolCard`, `ProtocolDetail`, `PhaseCard` | Scheduled section/badges/start labels; detail filters future events and suppresses live dose-change/pause/completion actions. |
| `ActivateProtocol`, `PlannedProtocols` | Planned-only selection; a future activation date commits configuration and derives Scheduled. No automatic status write is required later. |
| `DoseChangeAction` | Requires a current phase; Scheduled has none. Also hidden by detail. |
| `lib/health/loadTimeline.ts`, `timeline.ts`, `components/timeline/TimelineBaseline.tsx` and Timeline views | Loaded event dates are capped at local today. Baseline current-active count requires start <= today. Normalization itself is date-agnostic; all runtime callers (loadTimeline, Today recent changes, ProtocolDetail) apply a date bound. |
| `lib/health/analyst/context.ts`, `evidence.ts` | Loader is raw owner-scoped source data; evidence filters future events and delegates current treatment state to historical reconstruction. |
| `app/api/health-analyst/route.ts`, `components/health/HealthAnalyst.tsx` | Fixed UTC-day leak: browser timezone header resolves server as-of day. |
| `lib/health/longitudinal/history.ts`, `interventions.ts`, `engine.ts`, `load.ts`, presentation | State is absent before start; interventions and derived phase boundaries are capped by as-of date. |
| `app/api/health-longitudinal/route.ts`, `components/health/LongitudinalChanges.tsx` | Fixed UTC-day leak using the browser timezone header. |
| `lib/health/loadProtocolOverlay.ts`, `components/health/ProtocolOverlayView.tsx`, chart/context children | Fixed future lab-window query and All-window derived-marker leaks. Query dates and displayed event markers are capped at local today. |
| `components/health/HealthBriefing.tsx`, `lib/health/healthBriefing.ts` | Supplies explicit client-local as-of date; canonical intervention/history engine enforces it. Overlay source loader is now capped too. |
| `lib/health/report/model.ts`, `intelligence.ts`, `service.ts` | Current state and report history already date-bounded. Fixed lab-context markers that regenerated future starts/phases from saved rows. Intelligence timeline uses bounded detectInterventions. |
| `app/api/health-report/route.ts`, `components/health/DoctorReport.tsx` | Fixed UTC-day leak using browser timezone header. Printed/PDF report uses the same bounded model. |
| Today `exportToCSV` | Fixed: treatment-history CSV excludes Planned and Scheduled rows. Completed/historical rows remain eligible. |
| `app/share/[token]/page.tsx` | Fixed unconditional Started label. Shared configuration uses neutral Start date wording because server render has no viewer timezone; undated configuration says Planned. It does not claim current Active status or completed treatment history. |
| `app/api/cron/route.ts` | Fixed vial-expiry query: joins protocol and requires stored active plus committed start <= conservative local-day cutoff. No dose-reminder cron exists. |
| `app/api/push/route.ts`, `public/sw.js`, push configuration | Generic journal reminders and push transport, not protocol/dose consumers. They do not infer active treatment. |
| `app/api/create-protocol`, `lib/health/protocolMutations.ts` | Canonical writers, not current-active consumers. RPC values stay active/planned; future configuration does not require a stored scheduled status. |
| SQL save/activation functions | Creation/activation records prospective events at committed start. New v2 pre-start edits preserve identity and move prospective events. Readers apply date bounds. |
| SQL `change_protocol_dose_v1`, `continue_latest_phase`, lifecycle transitions | UI requires current/expired phases and excludes Scheduled live actions; Scheduled setup edits use save v2. Completion v2 rejects pre-start completion. Fixed direct continuation RPC leak by requiring start <= current_date before it can write history; its signature, owner, security and established continuation behavior are preserved. The later production ACL finding is corrected as described below. Dose changes and ordinary lifecycle transitions already require effective date >= start and <= current_date. |
| Inventory exports/templates | Inventory records, not active-protocol or treatment-history consumers. |
| Admin/tracker/demo static copy; root `fix-*`, `write-*`, `rewrite-manage.js`, `feat2-vial-expiry.js` | Static examples or historical source-editing scripts, not current runtime readers. Package scripts do not execute those historical scripts. Left unchanged. |

## Server calendar limitation

Analyst, longitudinal history, and Doctor Report now send `X-Timezone` and resolve the current date using that timezone. Invalid/missing headers and cron use UTC-12, the earliest local calendar day worldwide. This avoids exposing a future-local start but can delay first-day inclusion for old clients and a vial-expiry reminder by up to 26 hours. Cron currently stores no user timezone; adding timezone persistence is outside this audit. Generic journal reminders are unchanged.

## Migration contract and security

Reviewed function lineage in migrations 090001, 100001, 110001, 140001, 160001, 200001, 220001, and 230001. Other preceding migrations do not redefine the Scheduled save wrapper or its protocol-save dependencies.

`202609240001_scheduled_protocols.sql` replaces `public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text)` and adds the start guard to the existing `continue_latest_phase(uuid,uuid,uuid)` definition. No new overload or status. Save parameters retain their names/order and defaults: continued-from NULL, removed IDs '{}', effective date NULL, timezone 'UTC'. Return remains uuid; continuation still returns void with no optional parameters. SECURITY INVOKER and search_path=public remain intact for both. The save function's TimeZone=UTC is restored on return; continuation retains its existing session-calendar contract. CREATE OR REPLACE retains the existing owners; no ALTER OWNER occurs. Save PUBLIC/anon remain revoked, authenticated retains EXECUTE. Production preflight found a direct anon EXECUTE grant on continuation. The migration now explicitly revokes EXECUTE from PUBLIC and anon for public.continue_latest_phase(uuid,uuid,uuid), and explicitly grants EXECUTE to authenticated, service_role, and postgres. Other signatures and grants are untouched. Owner checks, row locks, canonical nested ownership checks, and RLS apply.

Executable PGlite tests compare the complete public-function catalog before/after/reapplication (including OIDs, signatures, defaults, return types, owner, ACL, security/configuration, and unchanged other function bodies). Tests compare existing RLS flags/policies, execute authenticated saves, reject unauthenticated/anon and cross-owner operations, and verify failed writes preserve prospective history. Both no-override and explicit future-start payloads pass; optional-argument defaults and named arguments are exercised. Repeated migration application and repeated pre-start saves preserve identities and avoid duplicate start events.

The production-grant regression seeds direct anon and PUBLIC access before applying the migration. It executes the read-only preflight before and after, verifies actual anon calls fail with permission denied, verifies authenticated owners can continue and other owners cannot, and checks all three retained roles after both applications. Catalog comparisons allow only the intended continuation ACL correction on the first application and require exact equality on repeat application. The preflight reports effective service_role/postgres access and requires it for continuation, in addition to denying PUBLIC/anon and allowing authenticated.

These tests run in isolated PostgreSQL, not production. The reported production anon grant remains present until the corrected migration is deployed. Re-run the read-only preflight afterward; owner and full-grant review still apply. Prior committed migrations remain unchanged.

## Staging and deployment

Validation: 72 focused tests pass without skips. Broader regressions: 387/393 pass; six failures reproduce on HEAD (two Doctor Report presentation assertions, one longitudinal pagination assertion, one Timeline filter assertion, two Today presentation assertions). No new lint findings relative to HEAD. TypeScript, production build, and git diff --check pass. SQL runs only in the isolated PGlite test database. Authenticated browser and deployed schema/RLS smoke tests remain deployment QA.

MPP-010 and its date hotfix are already in HEAD (`54eb020`, `b6ad8ef`), including migrations 220001/230001, QuickProtocolFields and protocolMutations. The previous staging list was complete for the prior Scheduled implementation; the audit adds consumer fixes, this report, and executable regressions. BottomTabBar and mac-handoff-checklist remain unrelated and excluded.

Apply missing prerequisites in timestamp order in staging, then 240001, then deploy the app/API together. Smoke-test future creation/preparation, rescheduling, Planned activation, local-midnight Today/counts, all report/export/history surfaces, and notification suppression. Repeat the same migration-first order in production. The new function is compatible with the committed frontend RPC signature; the new frontend needs 240001 to accept future creation. Old clients without timezone headers get conservative history until refreshed.

ACL follow-up validation: executable SQL/preflight regression passes; targeted lint and diff checks are rerun for this change. The broader validation totals above describe the preceding release audit. No connected-database changes were made.
