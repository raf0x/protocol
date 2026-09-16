# Automation Roadmap

Date: 2026-09-12. Status: strategy proposal. No implementation is authorized by this document.

> **Revision: 2026-09-16 — reconciliation update.** This is an update, not a rewrite of history. Everything below this notice through the end of the original "Adversarial review" section is preserved exactly as written on 2026-09-12, with inline status annotations (`> STATUS (2026-09-16): ...`) added where reality has since diverged. The original NEXT/LATER/DEFER sections are likewise preserved with annotations. Two new sections were added for this revision: **"Shipped since original roadmap (as of 2026-09-16)"** immediately below, and **"Recommended next foundation (2026-09-16 update)"** near the end. No implementation is authorized by this revision either; it is reconciliation and one recommendation, per the same governing standard as the original.

Promise: **Record once. Understand what changed, in context. Review the evidence when needed.** Governed by the [Product Constitution](product-constitution.md); repository evidence and dependencies are detailed in the [architecture audit](north-star-product-architecture.md).

"99% automated" is not a delivery metric. Evaluate duplicate entry, correction steps per import, manual reconciliation, time spent reconstructing history, and agreement of derived facts across surfaces. Establish actual baselines before promising reductions. Never collect health payloads in operational monitoring to measure these outcomes.

## Shipped since original roadmap (as of 2026-09-16)

Reconciled against the real repository, not commit-message titles. Every claim below cites the exact file/function/test verified. Full candidate-by-candidate detail is in the annotated tables further down; this section is the top-level summary.

### PDF import failure instrumentation — SHIPPED (2026-09-16, implemented same day as recommended)

Commits `009ffe8` (instrumentation) and `98bc8b7` (an unrelated test-narrowing fix committed just before it, from the Doctor Report identity question above). This is the recommendation from "Recommended next foundation (2026-09-16, final revision)" below, approved and built the same day.

- `lib/health/labImport.ts` `classifyImportError` maps the ~19 already-distinct, already-enumerated thrown error messages (`'This PDF appears to be scanned...'`, `'CSV has an unclosed quoted field.'`, etc.) to fixed, stable slugs (`pdf_scanned`, `csv_quote_error`, `file_too_large`, ...) rather than the raw message — a later copy edit can't change what gets aggregated, and no unanticipated message text can reach the logging boundary. Verified every known message with a standalone script before committing; caught and fixed a real classification bug in the process (the scanned-PDF rule was a bare `/scanned/`, which also matched the unrelated "no rows detected" message because it mentions "Scanned PDFs require OCR" in passing — narrowed to `/appears to be scanned/i`).
- `components/health/ImportLabForm.tsx` wires this into both failure paths (PDF/CSV `open()`, CSV column-mapping submit) and adds the "needs review" signal: when any parsed row has the existing `included === false` flag (already computed by `reviewRepeatedCandidates`, shared by CSV and PDF), a `pdf_needs_review`/`csv_needs_review` event fires with no count or content attached.
- `lib/clientMonitoring.ts` `reportClientError` gained optional `errorType`/`status` overrides (existing callers `app/global-error.tsx`/`app/error.tsx` unaffected — verified by reading both call sites before changing the signature) and a `typeof window !== 'undefined'` guard on the pathname fallback, fixed opportunistically per Rafael's explicit go-ahead while already touching the file.
- Boundary: only the classification slug and the existing `import_confidence` signal are ever sent — never raw parsed values, biomarker names, or document content, the same standard just established for Doctor Report's identity boundary. Reuses the existing `captureOperationalError`/`app/api/monitor` authenticated pipeline, already proven in production via the global error boundaries; no new infrastructure.
- Validation before commit: TypeScript clean, all three files lint clean, `tests/lab-import-intelligence.test.mjs` + `tests/lab-import-review.test.mjs` + `tests/labs-v2.test.mjs` + `tests/launch-blockers.test.mjs` at 128/129 (the one failure, a `privacy` page copy assertion, confirmed pre-existing by stashing the change and reproducing it identically on bare `main`), production build succeeded.

### Shared Lab Evidence V1 — SHIPPED, verified in scope

The NOW-tier foundation itself shipped in commit `43e4b7b` (the same commit that added this document) as `lib/health/labEvidence.ts`. This was not later work — it predates or is concurrent with the roadmap's own creation. See the dedicated status note under "Adversarial review" below for full success-criteria verification; summary: **5 of 6 success criteria verified true, 1 not independently verifiable from the repository.** (Updated 2026-09-16, later same day: the one previously-red regression test behind criterion 2 is now fixed — see "Currently failing tests" below.)

Confirmed genuinely wired into all four consumers the roadmap named (not a parallel engine):
- `lib/health/biomarkerIntelligence.ts` `compareLatest` (line ~98) delegates to `labTrajectory(...).latestRecordedPair.comparison`, itself `buildLabTrajectory`/`compareLabDates` from `labEvidence.ts`.
- `lib/health/longitudinal/engine.ts` `observation` (line 19) calls `compareLabDates` (line 42) and `labLimitations` directly from `labEvidence.ts` for baseline/follow-up arithmetic.
- `lib/health/analyst/evidence.ts` `buildAnalystContext` (line 114) now carries a comment "delegates to canonical findings instead of rebuilding membership/transitions" (line 219) — the local transition loop the roadmap's own adversarial review flagged as able to treat `unknown` prior status as "newly flagged" is gone.
- `lib/health/report/model.ts` `buildDoctorReport` (line 28) imports `labComparisonSummary`/`labLimitations` from `labEvidence.ts` directly.

### Full finding ranking and briefings — SHIPPED

- `lib/health/labFindings.ts` (commit `87c858e`): "Deterministic, derived lab findings built only from Shared Lab Evidence" (file's own header comment) — imports only types from `labEvidence.ts`, adds no parallel arithmetic.
- `lib/health/healthBriefing.ts` + `components/health/HealthBriefing.tsx` (commit `11c7969`): imports `labFindingsSummary`, `labEvidence`, and `healthStateAtDate` — composes existing derived state per the north-star doc's explicit instruction, no new persisted concept.
- `tests/lab-findings.test.mjs` (43/43 pass), `tests/lab-findings-integration.test.mjs` (28/28 pass) verified passing.
- `tests/health-briefing.test.mjs`: 66/68 pass — see "Currently failing tests" below for the 2 failures.

### Historical protocol-context consolidation and missing-event capture — SHIPPED

Commit `d3431cd`, migration `supabase/migrations/202609160001_historical_protocol_context_v1.sql`.

- `lib/health/protocolOverlay.ts` `contextAtDate` (line 58) is now explicitly commented "Presentation adapter only... must not replay [history] independently" and calls `healthStateAtDate` (line 60) instead of maintaining separate resolver logic. `protocolActiveOnDate` (line 35) is a "Compatibility entry point backed by the canonical longitudinal lifecycle policy," delegating to `protocolActivityAtDate`.
- The exact gap the north-star doc named — `app/protocol/manage/page.tsx` `reactivateProtocol` "directly sets `status='active'` and clears `completed_date`" with no event — is fixed: `reactivateProtocol` (line 157) now calls `transitionProtocol({..., action: 'reactivate', ...})` (`lib/health/protocolMutations.ts` line 49), which invokes the new `transition_protocol_v1` RPC and inserts a `protocol_events` row.
- The other named gap — "the structured wrapper loops surviving phases without emitting a removal snapshot" — is fixed: `save_protocol_with_events_v1` in the new migration explicitly loops `p_removed_compound_ids` and inserts a `compound_removed` event with the prior phase-state snapshot; it also handles `phase_boundary_change` and `preparation_change` events distinctly, addressing "boundary-only edits" and "preparation-only changes" respectively.
- `tests/historical-protocol-context.test.mjs`: **42/42 pass**, including `reactivation is an explicit longitudinal intervention`, `removed compound snapshots preserve earlier state without name matching`, `boundary-only snapshots prevent a later saved boundary from rewriting earlier history`, `history consolidation adds no parallel persisted state model`, `history consolidation adds no AI or provider dependency`, and `new migration is function-only and performs no historical backfill`.

This also fully covers the separate candidate row "Existing HealthState/HealthVersion reuse — compose existing derived state, no parallel model": the explicit test `history consolidation adds no parallel persisted state model` passes.

### Doctor Report intelligence integration — SHIPPED

Commit `2f36303`. `lib/health/report/intelligence.ts` `buildReportIntelligence` imports `selectHeadlineFindings` (`labFindings.ts`), `deriveCurrentLabFindingSet` (`labFindingsSummary.ts`), and `healthStateAtDate`/`protocolActivityAtDate` — genuinely consumes the shared foundation, not a separate calculation. Wired into `buildDoctorReport` at `lib/health/report/model.ts:96`.

**Resolved, 2026-09-16 (same day, second pass):** this section originally flagged `tests/lab-evidence.test.mjs`'s `Report identity-free projection remains deterministic without AI` as a "boundary caveat" — `report.intelligence.headlineChanges[].evidence` carries raw `resultId`/`panelId`. Attempting the obvious fix (strip those fields) broke a different, *deliberately written*, currently-passing test: `tests/doctor-report.test.mjs`'s `V2A identities are traceable but raw document and owner metadata are excluded`, which explicitly asserts `readings[0].resultId === 'old-r'`. That test is the later, more considered spec (commit `2f36303`, the same commit that built `report/intelligence.ts`); the "identity-free" test predates the `intelligence` field entirely (commit `43e4b7b`) and was never reconciled against it. Checked directly: `resultId`/`panelId` are never rendered as visible text anywhere (screen or PDF — "Save PDF" is `window.print()` on the same DOM, no separate template; the only usage is a React `key` prop), and `lib/health/report/ai.ts` `buildReportAiContext` — the actual AI-bound path — already manually projects only `value`/`unit`/`date` into plain strings and never spreads the raw evidence objects, so the AI boundary was never actually crossed. Resolution: kept the newer test as the correct spec, narrowed the older test to check `buildReportAiContext`'s output specifically (which is what its own name, "...without AI," was actually about) instead of the whole report object. `tests/lab-evidence.test.mjs` is now 98/98.

### Flat protocol-change filter refinement (identity-safe treatment filtering) — SHIPPED

Commits `65e9ab0`, `ec2661a`. `lib/health/protocolIdentity.ts` (episode identity = exact `protocolId`; compound identity = exact `protocolId + compoundId`), consumed by `lib/health/timelinePresentation.ts` and `lib/health/longitudinal/presentation.ts`, with UI in `app/timeline/page.tsx`, `components/timeline/TimelineFilters.tsx`, `components/health/LongitudinalChanges.tsx`. `tests/protocol-identity.test.mjs` (16/16 pass), `tests/timeline-ui.test.mjs` (11/11 pass), `tests/protocol-change-filter.test.mjs` (12/12 pass).

### PDF import intelligence — PARTIALLY SHIPPED

Commit `9e4cabc`. What exists: a substantially stronger **generic** layout-aware parser (`lib/health/labPdfParser.ts`, 199 lines — `documentMetadata`, geometry-based row grouping in `pdfImport.ts` `groupPdfTextRows`) plus a validation/repeat-review layer (`lib/health/labImportValidation.ts` — `validateLabCandidate`, `reviewRepeatedCandidates`).

What the candidate description specifically asked for and is still missing: **actual named provider adapters**. `lib/health/labImport.ts` `parsePdfLines(lines, filename, adapters: PdfAdapter[] = [])` has a real, tested plugin interface (`matches`/`parse`, with graceful fallback on adapter failure — see `tests/labs-v2.test.mjs`), but the production call site, `components/health/ImportLabForm.tsx:25`, calls it with **no adapters argument** — every import goes through the generic fallback parser. Zero concrete provider adapters are registered. The `tests/fixtures/lab-import-quest.mjs` fixture and its test in `tests/lab-import-intelligence.test.mjs:50` validate that the *generic* parser handles a Quest-shaped layout, not a Quest-specific adapter.

Also unmet: the roadmap's stated selection criterion — "select using actual failed examples" / prioritize "only for documented high-frequency failures" (echoed in the original NEXT section below). No import-failure corpus or tracking exists anywhere in this repository. What shipped is real, general-purpose robustness work; it was not driven by measured failure data as scoped, and the "targeted adapters" half of the candidate has not shipped at all.

### Guided Health Analyst — PARTIALLY addresses a LATER item

Commit `7bcd690`. `lib/health/analyst/actions.ts` defines 5 bounded `GuidedAnalystAction` values (`since_last_labs`, `current_snapshot`, `largest_changes`, `missing_data`, `protocol_context`) each with a fixed instruction, replacing free-form prompting with a bounded menu that consumes canonical deterministic findings (`lib/health/analyst/findings.ts` `AnalystDeterministicFinding` — explicitly commented "No canonical identity/provenance objects may be spread into it"). This meaningfully reduces the LATER-tier burden "Repeatedly ask Analyst after a new panel," but the LATER item's full scope — automatic recompute, source-change invalidation, and rate-limit-respecting *proactive* triggering — is not what shipped here; this is still an on-demand, user-initiated action, not automatic invalidation/recompute. Classified PARTIALLY SHIPPED against the original LATER description.

### Confirmed NOT STARTED (checked directly, including LATER/DEFER rows, per your instruction to check those too)

- **OCR / broader document ingestion** (LATER): `lib/health/pdfImport.ts` `extractPdfText` (line 20) carries the comment "Local embedded-text extraction only. Never renders pages or invokes OCR" and explicitly throws `'This PDF appears to be scanned...'` (line 43) rather than attempting OCR. Unchanged.
- **AI protocol import / ambiguity assistance** (LATER): `app/api/create-protocol/route.ts` contains no AI/provider code at all.
- **Proactive summaries / follow-up intelligence** (LATER): `app/api/cron/route.ts` was last touched in commit `1504ed6` (2026-09-10, before this roadmap existed) and only sends journal-reminder and vial-expiry pushes — unrelated to lab findings or health evidence, no deterministic-recompute/staleness-invalidation logic. Not what this candidate describes.
- **Apple Health / wearables / EHR / complex notifications** (DEFER): zero matches repository-wide for `Apple Health`, `HealthKit`, `wearable`, `EHR`, or `FHIR`.

### Approved as a minor NOW item, not a foundation (2026-09-16, same day)

**In-app "N new findings since your last visit" indicator on `HealthBriefing`.** This was the first version of this revision's "recommended next foundation" — rescoped delivery-free after finding [docs/push-v1-decision.md](push-v1-decision.md) deferred push behind 8 unmet criteria (see full history in "Recommended next foundation" below). On review, Rafael approved it explicitly as a **minor NOW-tier item**, not the roadmap's next foundation — it's real but small: one persisted per-user marker, diffed against `labFindings.ts` output on `/health` load, zero push/delivery code touched. Not yet built. Sized like "Flat protocol-change filter refinement" was in the original document (presentation-layer, not foundational), not like Shared Lab Evidence V1.

### Currently failing tests (updated 2026-09-16, same day, second pass)

534/538 tests pass across the ten files most relevant to this roadmap (`lab-evidence`, `lab-findings`, `lab-findings-integration`, `health-briefing`, `analyst-findings`, `doctor-report`, `longitudinal`, `protocol-identity`, `timeline-ui`, `protocol-change-filter`). 4 remain, none fixed as part of this pass (out of scope beyond the one Doctor Report boundary fix above):

1. `tests/doctor-report.test.mjs` — `V2 report removes legacy section checkboxes and renders intelligence instead`, and `V2 report presentation is scan-first and bounded`: both assert literal source-text patterns (`/report\.intelligence/`, `/verification\.map/`) against `components/health/DoctorReport.tsx`. The underlying code is present and functioning — `const intelligence = report?.intelligence` (line 131), `intelligence.verification.filter(...).map(...)` (line 144) — but a `.filter()` step was inserted between `.verification` and `.map()` since the test was written, breaking the literal regex. Same class of stale, over-literal assertion as the Today-page section-order test fixed earlier this week (commit `353dbf1`) — functionality intact, assertion brittle.
2. `tests/health-briefing.test.mjs` — `evidence details retain current/previous/delta facts and trend links`: regex `/Current: 30 mg\/dL/` doesn't match; the actual rendered output does contain `30 mg/dL` and all the same underlying facts, just not under that exact literal label — looks like the same class of copy/format drift, most likely from the later `8eaa0b1`/`928332c` UI-polish commits, not independently confirmed.
3. `tests/health-briefing.test.mjs` — `supplemental ordering prefers recorded source-row order without biomarker hardcoding`: expected 3 biomarker names, actual output has 2 (missing `'Albumin'`). This one I have **not** root-caused — it could be a genuine ordering/inclusion regression or another stale fixture. Flagging honestly rather than guessing.

#1 looks stale (same pattern as the already-fixed Today-page test); #2 likewise; #3 is unresolved and should not be assumed either way.

---

## NOW *(original 2026-09-12 recommendation — preserved as historical record)*

> STATUS (2026-09-16): This project shipped, essentially in scope. See "Shared Lab Evidence V1 — SHIPPED, verified in scope" above for the consumer-by-consumer verification, and the success-criteria walkthrough appended after the original text below.

**One project: Shared Lab Evidence V1.** Consolidate existing comparison eligibility and promote typed trajectory facts. This is an extension of working lab normalization and longitudinal code, not a new health-state platform or visible redesign.

Use existing saved numerical labs. Keep protocol-change observations lab-only, preserve source IDs, and make uncertainty explicit. Migrate the small consumer-specific fact builders to shared output within their existing presentation contracts. Do not add a new AI surface, importer, database table, or global history resolver in this project.

### Candidate evaluation

H/M/L are relative planning judgments, not measured user outcomes. Value, work reduction, insight, reuse, and leverage rate expected benefit. Risk and cost rate implementation burden. Priorities follow dependencies, not an averaged score.

| Candidate | User value | Work reduction | Insight | Reuse | Leverage | Risk | Cost | Decision | Status (2026-09-16) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shared lab eligibility, comparisons, descriptive trajectories | H | H | H | H | H | M | M | NOW: foundation | ✅ SHIPPED |
| Full protocol-state consumer consolidation and missing-event capture | H | M | H | H | H | H | M–H | NEXT: prerequisite for wider historical synthesis | ✅ SHIPPED |
| Targeted PDF adapters / import reconciliation | H | H | M | H | M | M | M | NEXT: select using actual failed examples | ◐ PARTIALLY SHIPPED |
| Full finding ranking and briefings | H | H | H | H | H | M–H | M | NEXT: requires shared facts | ✅ SHIPPED |
| Existing HealthState / HealthVersion reuse | H | M | H | H | H | M | M | NEXT: compose existing derived state; no parallel model | ✅ SHIPPED |
| Doctor Report intelligence integration | H | H | H | H | M | M | L–M | NEXT: consumer of the foundation | ✅ SHIPPED |
| Flat protocol-change filter refinement | M | M | L | L | L | L–M | L | NEXT: presentation, not foundational | ✅ SHIPPED |
| OCR / broader health-document ingestion | H | H | M | H | M | H | H | LATER: document provenance and evaluation corpus first | ⬜ NOT STARTED |
| AI protocol import / ambiguity assistance | M–H | H | M | M | M | H | H | LATER: structured review, consent, no automatic prescription | ⬜ NOT STARTED |
| Proactive summaries / follow-up intelligence | H | H | H | H | M | H | H | LATER: stable evidence, consent and delivery policy first | ⬜ NOT STARTED — recommended next, see below |
| Apple Health / broad wearables / activity, sleep, nutrition | Potential H | H | Unproven here | M | L for current labs | H | H | DEFER: separate evidence models and native permissions | ⬜ NOT STARTED |
| EHRs / complex notifications | Potential H | H | Unproven here | M | L for current labs | H | H | DEFER: integration/delivery work is not the missing lab foundation | ⬜ NOT STARTED |

### Automation audit

Each row identifies actual work or a clearly marked future workflow. Exact implementation owners are cited; future aspirations are not described as existing capabilities.

| Current user work | Automatable? | Proposed automation | Existing code to reuse | Dependency | Risk | Priority | Status (2026-09-16) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Reconcile comparisons across Labs, Changes, Analyst, Report | Yes, for eligible data | Shared typed comparisons, exclusions and lineage | [biomarkerIntelligence.ts][bio] `compareLatest`; [engine.ts][engine] `observation`; [evidence.ts][evidence] `buildAnalystContext`; [report/model.ts][report] `buildDoctorReport` | Existing normalized series | Silent change of comparison policy | NOW | ✅ SHIPPED |
| Inspect a chart to discover sequence or earlier observed values | Yes, descriptively | Ordered differences, earliest/latest pair, prior observed extent | [labs.ts][labs] `biomarkerHistories`; [biomarkerIntelligence.ts][bio] `trendChart` | Eligibility and source contract | Mistaking prior history for normality | NOW | ✅ SHIPPED |
| Recheck what a reported transition actually means | Yes, with known statuses | Typed range-transition/missing-comparator facts | [evidence.ts][evidence] local transition and panel-membership loops | Known prior status, compatible ranges | Calling unknown→high "newly abnormal" | NOW | ✅ SHIPPED — the local loop this row named is gone; see `labEvidence.ts` `LabRangeTransition` |
| Reconstruct protocol context across views | Partly | Adapt older consumers to existing conservative replay; prospectively capture missing events | [history.ts][history] `healthStateAtDate`; [overlay.ts][overlay] `contextAtDate`; [Structured events migration][events-sql] `save_protocol_with_events_v1` | Historical parity fixtures and explicit gaps | Inventing deleted or unrecorded history | NEXT | ✅ SHIPPED |
| Select priority and reconcile multiple facts | Partly | Deterministic finding reasons and concise briefing | [biomarkerIntelligence.ts][bio] `labIntelligence`; [evidence.ts][evidence] `ContextFact` production; [report/model.ts][report] trend ordering | Typed facts, disclosed limits | Priority mistaken for medical urgency | NEXT | ✅ SHIPPED |
| Re-enter predictable import metadata / fix repetitive parsing errors | Partly | Tested provider adapters and ambiguity-focused review | [labImport.ts][import] `detectColumns`, `parsePdfLines`; [labEditor.ts][editor] `duplicateRows`, `prepareLabSubmission` | Representative failures and provenance | Wrong panel date or alias silently accepted | NEXT | ◐ PARTIALLY SHIPPED — generic parser + review shipped; adapters unwired |
| Manually assemble a clinician report's history | Mostly | Consume shared findings and state in current report | [report/service.ts][report-service] `createDoctorReportFromSource` | Lab facts; historical consolidation for regimen claims | AI summary diverges from deterministic report | NEXT | ✅ SHIPPED |
| Navigate many intervention events | Yes, presentation only | Identity-preserving primary protocol/episode grouping, secondary event choice | [presentation.ts][presentation] `protocolChangeOptions`, `protocolChangeUrl`; [manage/page.tsx][manage] `continued_from_protocol_id` | Explicit identity links | Blends or episodes merged by name | NEXT | ✅ SHIPPED |
| Determine whether enough follow-up exists | Partly | Explain dates, missing same-unit pairs, and incomplete windows | [engine.ts][engine] `EvidenceStrength` reasons and `limitations`; [evidence.ts][evidence] gaps | Shared gap contract | Turning a data gap into a prescribed testing schedule | NEXT | ✅ SHIPPED — subsumed into `labEvidence.ts` `LabGap` |
| Scan-derived or unusual health documents need transcription | Partly | OCR/document parsing with original-source review | [pdfImport.ts][pdf] `extractPdfText`; [labImport.ts][import] `parsePdfLines` | Evaluation set, source handling, consent for external processing | Extraction error; larger privacy scope | LATER | ⬜ NOT STARTED |
| Manually enter a protocol from outside text | Partly | Draft structured fields; user confirms identity, timing, and dosing meaning | [dosingEntry.ts][entry] `entryFromForm`, `interpretEntry`; [protocolMutations.ts][mutations] `saveProtocolWithEvents` | Import schema and consent-specific provider boundary | Misclassifying syringe units as medication IU | LATER | ⬜ NOT STARTED |
| Repeatedly ask Analyst after a new panel | Partly | Recompute deterministic briefing; optionally request consented synthesis | [analyst/service.ts][service] `analyzeHealthContext`; [aiConsent.ts][consent] `hasCurrentAiConsent` | Stable facts, source-change invalidation, rate limits, consent at execution | Silent sharing, stale or repetitive conclusions | LATER | ◐ PARTIALLY SHIPPED — guided actions ship; auto-invalidation does not |
| Future wearable/lifestyle/EHR synchronization | Not within this foundation | Evaluate separate connectors and source-specific models later | Existing lab-only [measurements.ts][measurements] `normalizeMeasurements` is a boundary, not an integration hook | Native/integration permissions, data semantics, provenance | False cross-domain comparisons and privacy expansion | DEFER | ⬜ NOT STARTED |

### The one recommended foundation

**Name:** Shared Lab Evidence V1.

**Problem:** The same recorded labs are translated into pair comparisons, range statements, and priorities differently by different consumers. Full historical sequences remain mostly chart data, so users or AI must assemble context that deterministic code could supply once.

**Current code reused:** [labs.ts][labs] `LabObservation`, `BiomarkerHistory`, `biomarkerHistories`; [biomarkerIntelligence.ts][bio] `classifyBiomarker`, `compareLatest`; [longitudinal/measurements.ts][measurements] `normalizeMeasurements`; existing source references, same-unit restrictions, and loading/auth boundaries.

**Current code consolidated:** Measurement eligibility and arithmetic between `compareLatest` and [engine.ts][engine] `observation`; transition/panel-membership facts and percentage-based ordering inside [evidence.ts][evidence] `buildAnalystContext`; corresponding typed comparisons in [report/model.ts][report] `buildDoctorReport`. Preserve distinct consumer windows and presentation needs. Replace prose parsing with numeric fields; do not rewrite historical state or confounders.

**Why foundational:** Labs, longitudinal observations, Analyst, and Report already depend on this information. One reusable evidence contract unlocks richer interpretation without new input or provider calls. It is smaller than a canonical whole-person-state redesign and more broadly useful than another filter.

**Dependencies:** Existing imported/manual results; conservative alias registry; exact-unit grouping; source IDs/dates; explicit current comparison policies; synthetic parity fixtures. Missing assay information becomes a declared limitation, not a guessed match. Valid same-unit arithmetic is not a certificate of assay equivalence.

**Unlocks:** Reliable latest/previous/earliest and multi-reading facts; descriptive prior history; shared range transitions/data gaps; later ranked findings, briefing, protocol-aware context, and consistent Doctor Report/AI evidence. These downstream experiences are not all part of this project's release.

**Likely files/modules:** Existing `lib/health/biomarkerIntelligence.ts`, `lib/health/labs.ts`, `lib/health/longitudinal/measurements.ts`, `lib/health/longitudinal/engine.ts`, `lib/health/longitudinal/analyst.ts`, `lib/health/analyst/evidence.ts`, and `lib/health/report/model.ts`. If a separate owner improves cohesion, add one pure `lib/health/labEvidence.ts` module and make existing entry points delegate to it; never leave a parallel calculation engine. Extend `tests/labs-v2c.test.mjs`, `tests/longitudinal.test.mjs`, `tests/health-analyst.test.mjs`, `tests/doctor-report.test.mjs`; a dedicated `tests/lab-evidence.test.mjs` is reasonable. These are proposed future edits only.

> STATUS (2026-09-16): `lib/health/labEvidence.ts` exists exactly as this section speculated it might, and `tests/lab-evidence.test.mjs` exists too. No parallel calculation engine was left behind — verified above per consumer.

**Migration required? NO.** Derive facts from existing records and preserve missing information as missing. No new persisted concept, cache, finding table, or historical rewrite. If later evidence requires structured assay capture, propose the smallest additive change separately; do not use speculative schema work to expand this project.

> STATUS (2026-09-16): Confirmed true. No migration was added for `labEvidence.ts` itself (its only migration-adjacent dependency, `202609160001_historical_protocol_context_v1.sql`, belongs to the separate historical-context project below and adds functions only, no tables).

**In scope:**

- A typed result describing comparator eligibility, exclusions, contributing IDs, dates, units, supplied ranges/status provenance, source confidence where available, and explicit unknowns.
- Latest/previous/earliest comparisons, ordered recorded movements, and descriptive prior observed extent with date/count context. No inferred clinical baseline.
- Known-status range transitions and panel-membership facts; retain ambiguity for missing ranges and conflicting dates.
- Shared eligibility mechanics with explicit caller policies. Equal-valued duplicate handling must preserve all provenance and cannot treat value equality alone as assay equivalence. Existing intervention windows, same-day timing exclusion, and historical state remain unchanged.
- Consumer adapters using typed deltas rather than regexes over prose. Characterize existing output before switching; intentional eligibility corrections need explicit regression cases.

**Out of scope:** UI redesign, hierarchical filters, new HealthBriefing screens, full ranking product, new AI behavior, protocol-history repairs, dosing changes, schema/migrations, alias expansion without evidence, generic unit conversion, OCR, new integrations, journal-derived longitudinal metrics, and proactive delivery. Advanced stable/step-change labels wait for defensible rules; do not invent clinical thresholds.

> STATUS (2026-09-16): Scope held for `labEvidence.ts` itself — it is a pure derivation module (`lib/health/labEvidence.ts` line 3-4: "Pure derived lab facts... No reads, persistence, unit conversion, assay inference, or journal inputs"), no schema/migration, no dosing change. The out-of-scope items listed here (HealthBriefing, full ranking product, Doctor Report integration, proactive delivery) were correctly built as *later, separate* projects that depend on this one, not folded into it — matching the roadmap's own dependency discipline.

**Success criteria:**

1. The same eligible source pair yields identical arithmetic, source references, and declared limitations across consumers. Window selection remains an explicit input, not an accidental difference.

   > STATUS (2026-09-16): **Verified true.** All four named consumers call the same `compareLabDates`/`buildLabTrajectory` functions — see per-consumer citations above. `compareLabDates` is commented "The sole lab pair arithmetic/eligibility implementation. Callers choose dates" (`labEvidence.ts` line 130).

2. Unknown prior status cannot become "previously in range"; duplicate/conflicting dates, missing units, qualitative values, zero denominators, non-finite arithmetic, and assay uncertainty have explicit tested outcomes.

   > STATUS (2026-09-16, updated same day): **Verified true.** `labEvidence.ts` defines an explicit `LabGap` union covering every case named (`prior_status_unknown`, `same_day_records`, `conflicting_same_day`, `missing_unit`, `qualitative_value`, `non_finite_arithmetic`, `percentage_unavailable`, `assay_method_unknown`, etc.), and `tests/lab-evidence.test.mjs` is now **98/98**, including cases like `no arbitrary range-transition claim from equal same-day records` and `foreign owner pair is rejected`. (This file's one failing test was about a Doctor Report boundary question, not this criterion's gap logic, and has since been resolved — see "Doctor Report intelligence integration" above.)

3. A multi-date fixture can produce a dated sequence and prior-history context without AI or user reconstruction. Prior extent excludes the current reading and reports how many earlier dates support it.

   > STATUS (2026-09-16): **Verified true.** `LabTrajectory.priorObservedExtent` (`labEvidence.ts` line 67) is computed from `ordered.slice(0, -1)` (line 167), explicitly excluding the latest reading, with `count`/`start`/`end` fields.

4. Every generated fact can identify its source observations. Different protocols, phases, events, episodes, and blends remain distinct; no journal field changes a Protocol Changes result.

   > STATUS (2026-09-16): **Verified true for lab facts** (`LabEvidenceObservation` carries `resultId`/`panelId`/`ownerId` throughout). The protocol-identity half of this criterion is verified by the separate, later-shipped identity-safe filtering work (`lib/health/protocolIdentity.ts`), not by this module directly — the two together satisfy it. `tests/lab-evidence.test.mjs` includes explicit `weight`/`sleep`/`mood`/`energy`/`hunger` "cannot affect shared or longitudinal lab comparisons" tests, all passing.

5. Existing historical/dosing, consent, limiter, and deterministic-report fallback tests continue to pass. Add cross-consumer parity fixtures; run full tests, TypeScript, focused lint, and build in the eventual implementation.

   > STATUS (2026-09-16, updated same day): **Closer to true, not fully.** 534/538 tests pass across the ten most relevant files (see "Currently failing tests" above), up from 533 after the Doctor Report boundary fix; the deterministic-report fallback specifically still has 2 failing assertions in `tests/doctor-report.test.mjs`, though on inspection those look like stale literal-text assertions rather than a fallback failure. TypeScript/lint/build *were* rerun for the one code change made during this revision (the test-narrowing fix) — all clean — but not for the roadmap reconciliation as a whole, consistent with how the original document handled this note (see the original audit-validation paragraph after the adversarial review, also not rerun in 2026-09-12).

6. No duplicate records, new tables, provider payload expansion, or extra per-intervention queries. Existing consumer presentations remain usable without AI.

   > STATUS (2026-09-16): **Verified true for `labEvidence.ts` itself** — no new tables, no reads (module docstring: "No reads, persistence..."). Cannot independently verify "no extra per-intervention queries" at the database/network level from static source alone; this would need a runtime/query-count check this pass did not perform. Saying so rather than assuming it passed, per your instruction.

**Main technical risks:** Existing duplicate-date and percentage policies differ; naïve unification can silently change results. Range/status provenance and assay absence can make seemingly numeric facts misleading. Source caps and mutable imported values limit historical claims. Small adapters and fixture-based parity checks are preferable to replacing modules wholesale.

**Main product risks:** A backend-only refactor could ship no user benefit; require visible consistency in existing comparison/report output and useful typed multi-date facts, without a redesign. Users may read priority, familiar history, or temporal association as a medical judgment. Keep descriptive language, evidence access, and limits attached to facts.

### Adversarial review

**A. Strongest argument that this is the wrong next project**

The data may be the bottleneck, not another derivation layer. [biomarkerIntelligence.ts][bio] `compareLatest` is already reused by Labs, Analyst, and Report, while [engine.ts][engine] already computes repeated before/after comparisons. The visible problem could be solved by presenting those existing facts better. Meanwhile [pdfImport.ts][pdf] cannot recover scanned text, `parsePdfLines` requires review and lacks wired provider adapters, and [labs.ts][labs] has no typed assay metadata. Richer trajectories over insufficiently characterized measurements could create more convincing but less trustworthy output.

The historical case is stronger still: [manage/page.tsx][manage] `reactivateProtocol` clears completion without an event, and [Structured events migration][events-sql] `save_protocol_with_events_v1` does not record every boundary/preparation/removal change. Improving prospective source capture first would prevent ongoing information loss that no later algorithm can repair. The repository lacks usage/import-failure evidence proving lab fact consistency is the largest day-to-day burden.

**B. Why choose it anyway**

This proposal earns its place by consolidating, not duplicating, `compareLatest`. The code shows actual policy divergence, not merely theoretical cleanliness: duplicate handling differs in `observation`; Analyst ranking parses prose; locally generated transition facts can interpret prior `unknown` as newly flagged and bypass comparison eligibility; Doctor Report orders a separate projection. Those problems affect already loaded data across working surfaces. A typed contract can expose unknown method/provenance and prevent overstated transitions immediately, without claiming to recover missing history.

Prospective event-capture repair remains a gate before expanding historical protocol synthesis, but it does not repair fragmented lab facts. Import/OCR work cannot improve interpretation of the user's already recorded history. A filter alone improves navigation, not factual consistency. Choose the bounded lab foundation first, followed by evidence-led source/history repair before wider automation. If initial parity fixtures show source ambiguity eliminates most useful comparisons, stop expanding trajectory outputs and move the unresolved compatibility-capture work into the next approved project; do not loosen eligibility to justify this recommendation.

> STATUS (2026-09-16, updated same day): Both halves of this adversarial review aged well and both predictions came true, in sequence, exactly as **B** said they should. **A**'s "historical case" (`reactivateProtocol`, missing removal/boundary events) was built next and shipped in `d3431cd` — see "Historical protocol-context consolidation" above. **A**'s PDF/OCR concern remains accurate today: `pdfImport.ts` still cannot recover scanned text, and targeted adapters are still unwired (see "PDF import intelligence — PARTIALLY SHIPPED" above) — this part of the objection was never actually resolved, just correctly deferred. **B**'s core bet — that this module would surface real, not theoretical, policy divergence — is directly confirmed: the specific bug **B** named ("locally generated transition facts can interpret prior `unknown` as newly flagged") is verifiably gone from `evidence.ts` (see citation above). Net: the original adversarial review was honest and its recommendation held up under implementation, with the caveat that success criterion 5 is not fully green today (4 failing tests remain, all in unrelated presentation-copy assertions, not this module). The Doctor Report identity question raised earlier the same day is now resolved — see above.

## NEXT *(original — preserved, annotated)*

After the shared facts meet acceptance criteria, consolidate older historical-context consumers onto [history.ts][history] `healthStateAtDate` with completion-date and same-day parity fixtures. Audit prospective mutation coverage separately: reactivation, removed compounds, preparation-only edits, and boundary edits. No historical backfill by inference.

> STATUS (2026-09-16): ✅ SHIPPED — `d3431cd`, see above.

Then use existing derived `HealthVersion` and protocol states plus lab facts to support a small deterministic finding/priority layer, coverage gaps, and a concise HealthBriefing. Doctor Report should consume that same evidence; preserve [report/service.ts][report-service] deterministic fallback. Protocol-aware synthesis waits for the historical gaps to be explicitly handled. Flat event selection can then receive identity-preserving progressive disclosure as a contained UI task.

> STATUS (2026-09-16): ✅ SHIPPED — finding/priority layer (`labFindings.ts`), HealthBriefing (`healthBriefing.ts`), Doctor Report consumption (`report/intelligence.ts`), and identity-preserving event filtering (`protocolIdentity.ts`) all shipped, in this dependency order, per the sequencing this paragraph specified.

Prioritize import adapters/reconciliation only for documented high-frequency failures. Preserve [labEditor.ts][editor] review and [Labs V2 migration][labs-v2-sql] source guards. Do not automatically save ambiguous records or relax confirmation simply to reduce clicks.

> STATUS (2026-09-16): Partially honored. No documented high-frequency-failure corpus exists (so the stated gate was never actually cleared), yet PDF import work shipped anyway (`9e4cabc`) — generic-parser robustness, not "adapters... for documented high-frequency failures." `labEditor.ts` review and Labs V2 source guards remain in place; no evidence of relaxed confirmation to reduce clicks.

## LATER *(original — preserved, annotated)*

Broader document/OCR ingestion, AI-assisted protocol drafts, richer personal-history patterns, and follow-up intelligence need evaluated source handling and clear evidence boundaries first. Any future assay/specimen capture should be justified by real comparison failures and added to the existing source model rather than a parallel record system.

> STATUS (2026-09-16): Unchanged — confirmed NOT STARTED (OCR, AI-assisted protocol drafts) or NOT STARTED (proactive/follow-up intelligence) above. No parallel assay/specimen record system was created.

Proactive briefings should recompute deterministic facts from changed sources, avoid duplicate notifications, disclose missing evidence, and invalidate stale conclusions after corrections/deletions. Optional AI execution must check current consent at execution time, respect revocation and provider scope, and retain durable rate limits. Existing [aiConsent.ts][consent], [analyst/service.ts][service], and [durableRateLimit.ts][limiter] remain the boundaries. No silent upload of additional journal notes or source documents.

> STATUS (2026-09-16): Not started, but see "Recommended next foundation" below — this paragraph's prerequisites (stable deterministic evidence to recompute from) are now largely in place, which is the basis for the new recommendation.

## DEFER *(original — preserved, annotated)*

Apple Health, broad wearable ingestion, activity/sleep/nutrition intelligence, EHR integration, and complex notifications are outside the immediate longitudinal foundation. They require new permissions, provenance, source-specific comparison rules, and delivery behavior; the current [measurements.ts][measurements] lab-only normalizer is not an appropriate generic destination.

> STATUS (2026-09-16): Confirmed unchanged — zero repository evidence of any of this.

A universal patient-state database is not justified by this audit. Never treat saved AI findings as truth, infer causal treatment effects from these personal timelines, or correct historical doses automatically. Preserve manual fallback and existing Journal/Timeline behavior. This strategy run ends here with one recommendation; implementation requires a separate explicit approval.

> STATUS (2026-09-16): No universal patient-state database was created (confirmed by the passing test `history consolidation adds no parallel persisted state model`). This new strategy run also ends with exactly one recommendation, below, requiring separate explicit approval, per the same standard.

## How this recommendation changed twice in one day (history, condensed)

**First version:** "Proactive summaries," delivered through the existing push channel. Wrong — written without reading [docs/push-v1-decision.md](push-v1-decision.md), a deliberate, dated (2026-09-11) decision that push is **deferred** behind 8 named, unmet re-enable criteria (no per-subscriber timezone, no expired-subscription cleanup, two competing delivery paths, no iOS QA, four more), gated by `APP_STORE_V1_PUSH_ENABLED = false` in `lib/appRelease.ts`. That flag, checked directly, gates only the Profile opt-in UI — `app/api/cron/route.ts`'s delivery code never checks it. The "existing push channel" cited as reusable infrastructure was the exact thing this repo already looked at and chose not to build on.

**Second version:** rescoped delivery-free to an in-app "N new findings since your last visit" indicator on `HealthBriefing` — genuinely buildable with zero push code and zero interaction with any of the 8 criteria, verified point by point. Rafael reviewed this and approved it as a **minor NOW-tier item**, explicitly not the next foundation — see "Approved as a minor NOW item" above. Its own adversarial review said as much: no usage evidence it's actually needed, and a fair size comparison to "Flat protocol-change filter refinement" (presentation, not foundational).

That leaves the roadmap's other structurally-incomplete NEXT-tier candidate, PDF import, as the thing to actually evaluate for foundation status — not by default, but checked with the same discipline.

## Recommended next foundation (2026-09-16, final revision)

> STATUS: **SHIPPED**, same day, commits `009ffe8`/`98bc8b7`. See "PDF import failure instrumentation — SHIPPED" at the top of "Shipped since original roadmap" for full detail. Approved as analyzed below, with no changes to scope between recommendation and implementation.

**Name: PDF import failure instrumentation.** Not "build more adapters" — that was already correctly identified as blocked on its own stated prerequisite, "select using actual failed examples" / "documented high-frequency failures," and no such corpus exists anywhere in this repository (confirmed by repo-wide search, see "PDF import intelligence — PARTIALLY SHIPPED" above). This is that missing prerequisite: instrument the already-distinct, already-enumerated failure and ambiguity signals in the import path so a real, evidence-based adapter decision becomes possible later. It is an observability project, not a derivation layer — a different kind of thing than every other candidate in this document, and I want to name that plainly rather than force it into the same shape.

### Dependency check, run the same way as every other candidate

Everything this needs already exists, is already tested, and is already proven in production:
- `lib/monitoring.ts` `captureOperationalError`/`buildOperationalEvent` — server-only, writes a sanitized `{route, error_type, source, http_status, release, request_id}` row to `app_error_events`. No raw content, no health payload, by construction — this is the exact shape the constitution's own instrumentation constraint requires ("never collect health payloads in operational monitoring to measure these outcomes"), already built, not something to design.
- `app/api/monitor/route.ts` — already-authenticated (`createAuthenticatedServerClient`, silently drops unauthenticated calls), already size-capped (1KB), already best-effort (catches its own failures so monitoring can never break the app). `tests/launch-blockers.test.mjs` already exercises it.
- `lib/clientMonitoring.ts` `reportClientError(error, route)` — a one-line client helper that POSTs to `/api/monitor`. Already proven in production: it's what `app/global-error.tsx` and `app/error.tsx` (the app's global error boundaries) call today.
- The failure taxonomy to instrument already exists and is already granular: `lib/health/pdfImport.ts` and `lib/health/labImport.ts` throw 12+ distinctly-worded errors (`'This PDF appears to be scanned...'`, `'PDF extraction timed out...'`, `'This PDF could not be read...'`, `'CSV contains an unexpected quote...'`, and more), and `lib/health/labImportValidation.ts` already produces a structured `import_confidence: 'low' | 'medium' | 'high'` signal distinct from a hard failure — exactly the "needed reconciliation, not outright rejected" case the roadmap's own audit table names.
- `components/health/ImportLabForm.tsx` currently calls none of the above — confirmed by direct search. Import failures are completely invisible today; nobody, not even via server logs, would know if a real-world lab layout were failing badly.

Nothing here depends on anything currently unbuilt. This is, honestly, the lowest-friction, lowest-risk candidate remaining in the entire roadmap — the work is wiring 2-3 already-proven one-line calls into existing catch blocks, not building anything new.

**One honest caveat on "lowest layer":** this is not the lowest layer in *the same* dependency graph as the intelligence chain (`S→N→T→...→Q→U` in north-star-product-architecture.md section 7) — it's a prerequisite for a separate, always-somewhat-orthogonal branch (import reliability), not a node in that diagram at all. Within its own branch it genuinely is the first unblocked step; I'm not claiming it's "lower" than `Q→U` on the same axis, because that comparison doesn't apply across branches. Naming this distinction rather than blurring it.

### A. Strongest argument that this is the wrong one to build next

Instrumentation alone delivers **zero direct user-facing value** on its own — it's pure "measure now, decide later." If the actual goal is reducing import-correction burden, this doesn't reduce it; someone still has to build adapters afterward, and that step is *still* gated behind this one finishing (realistically, gated behind weeks or months of real usage accumulating before "high-frequency" is even a meaningful phrase) — meaning this candidate's own payoff is necessarily deferred, arguably making it a worse "foundation" pick than something with immediate payoff like Shared Lab Evidence V1 was. It's also small: wiring three already-built functions into a handful of catch blocks is closer to an afternoon task than a multi-week foundation, which raises the same "does this even deserve a dedicated strategy recommendation" question the in-app indicator's own review raised about itself.

### B. Evidence from the current repository that I'd choose it anyway

It is the literal, explicit, self-identified missing step of an item this roadmap already committed to in principle — not a new idea, the actual blocked half of "Targeted PDF adapters / import reconciliation," stuck since the original 2026-09-12 document specifically because nobody built the measurement. Every dependency is already shipped, already tested, and already proven correct in production via the exact same pipeline (global error boundaries use it right now) — the smallest infrastructure risk of anything left in this roadmap. And unlike almost every other remaining candidate — the in-app indicator (new persisted marker), OCR (new privacy/consent surface), AI protocol import (new provider call), wearables/EHR (new permissions model) — this one requires no new privacy or consent review at all, because it reuses a pipeline that was already built and already reviewed for exactly this constraint.

**Is this a close call?** No, and I want to say that plainly rather than hedge for the sake of symmetry. A's point about deferred payoff is fair but describes every measurement-before-building step, not a flaw specific to this one — the alternative (build adapters without measuring) is exactly what the original roadmap's own NEXT-tier paragraph explicitly forbade ("prioritize import adapters/reconciliation only for documented high-frequency failures"). There is no competing candidate left standing: OCR, AI protocol import, wearables, and EHR all remain genuinely blocked on unmet prerequisites (verified above and in the earlier reconciliation), and the in-app indicator was already reviewed and deliberately placed outside foundation status by Rafael. This is the one candidate left with nothing in its way.

This strategy run ends here with one recommendation. Implementation requires separate explicit approval, per the same standard the original document set.

[bio]: ../lib/health/biomarkerIntelligence.ts
[labs]: ../lib/health/labs.ts
[engine]: ../lib/health/longitudinal/engine.ts
[measurements]: ../lib/health/longitudinal/measurements.ts
[evidence]: ../lib/health/analyst/evidence.ts
[report]: ../lib/health/report/model.ts
[report-service]: ../lib/health/report/service.ts
[history]: ../lib/health/longitudinal/history.ts
[overlay]: ../lib/health/protocolOverlay.ts
[import]: ../lib/health/labImport.ts
[editor]: ../lib/health/labEditor.ts
[pdf]: ../lib/health/pdfImport.ts
[presentation]: ../lib/health/longitudinal/presentation.ts
[manage]: ../app/protocol/manage/page.tsx
[entry]: ../lib/health/dosingEntry.ts
[mutations]: ../lib/health/protocolMutations.ts
[service]: ../lib/health/analyst/service.ts
[consent]: ../lib/aiConsent.ts
[limiter]: ../lib/durableRateLimit.ts
[events-sql]: ../supabase/migrations/202609140001_structured_protocol_events.sql
[labs-v2-sql]: ../supabase/migrations/202609130001_labs_v2_edit_import.sql
