# Automation Roadmap

Date: 2026-09-12. Status: strategy proposal. No implementation is authorized by this document.

Promise: **Record once. Understand what changed, in context. Review the evidence when needed.** Governed by the [Product Constitution](product-constitution.md); repository evidence and dependencies are detailed in the [architecture audit](north-star-product-architecture.md).

“99% automated” is not a delivery metric. Evaluate duplicate entry, correction steps per import, manual reconciliation, time spent reconstructing history, and agreement of derived facts across surfaces. Establish actual baselines before promising reductions. Never collect health payloads in operational monitoring to measure these outcomes.

## NOW

**One project: Shared Lab Evidence V1.** Consolidate existing comparison eligibility and promote typed trajectory facts. This is an extension of working lab normalization and longitudinal code, not a new health-state platform or visible redesign.

Use existing saved numerical labs. Keep protocol-change observations lab-only, preserve source IDs, and make uncertainty explicit. Migrate the small consumer-specific fact builders to shared output within their existing presentation contracts. Do not add a new AI surface, importer, database table, or global history resolver in this project.

### Candidate evaluation

H/M/L are relative planning judgments, not measured user outcomes. Value, work reduction, insight, reuse, and leverage rate expected benefit. Risk and cost rate implementation burden. Priorities follow dependencies, not an averaged score.

| Candidate | User value | Work reduction | Insight | Reuse | Leverage | Risk | Cost | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shared lab eligibility, comparisons, descriptive trajectories | H | H | H | H | H | M | M | NOW: foundation |
| Full protocol-state consumer consolidation and missing-event capture | H | M | H | H | H | H | M–H | NEXT: prerequisite for wider historical synthesis |
| Targeted PDF adapters / import reconciliation | H | H | M | H | M | M | M | NEXT: select using actual failed examples |
| Full finding ranking and briefings | H | H | H | H | H | M–H | M | NEXT: requires shared facts |
| Existing HealthState / HealthVersion reuse | H | M | H | H | H | M | M | NEXT: compose existing derived state; no parallel model |
| Doctor Report intelligence integration | H | H | H | H | M | M | L–M | NEXT: consumer of the foundation |
| Flat protocol-change filter refinement | M | M | L | L | L | L–M | L | NEXT: presentation, not foundational |
| OCR / broader health-document ingestion | H | H | M | H | M | H | H | LATER: document provenance and evaluation corpus first |
| AI protocol import / ambiguity assistance | M–H | H | M | M | M | H | H | LATER: structured review, consent, no automatic prescription |
| Proactive summaries / follow-up intelligence | H | H | H | H | M | H | H | LATER: stable evidence, consent and delivery policy first |
| Apple Health / broad wearables / activity, sleep, nutrition | Potential H | H | Unproven here | M | L for current labs | H | H | DEFER: separate evidence models and native permissions |
| EHRs / complex notifications | Potential H | H | Unproven here | M | L for current labs | H | H | DEFER: integration/delivery work is not the missing lab foundation |

### Automation audit

Each row identifies actual work or a clearly marked future workflow. Exact implementation owners are cited; future aspirations are not described as existing capabilities.

| Current user work | Automatable? | Proposed automation | Existing code to reuse | Dependency | Risk | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Reconcile comparisons across Labs, Changes, Analyst, Report | Yes, for eligible data | Shared typed comparisons, exclusions and lineage | [biomarkerIntelligence.ts][bio] `compareLatest`; [engine.ts][engine] `observation`; [evidence.ts][evidence] `buildAnalystContext`; [report/model.ts][report] `buildDoctorReport` | Existing normalized series | Silent change of comparison policy | NOW |
| Inspect a chart to discover sequence or earlier observed values | Yes, descriptively | Ordered differences, earliest/latest pair, prior observed extent | [labs.ts][labs] `biomarkerHistories`; [biomarkerIntelligence.ts][bio] `trendChart` | Eligibility and source contract | Mistaking prior history for normality | NOW |
| Recheck what a reported transition actually means | Yes, with known statuses | Typed range-transition/missing-comparator facts | [evidence.ts][evidence] local transition and panel-membership loops | Known prior status, compatible ranges | Calling unknown→high “newly abnormal” | NOW |
| Reconstruct protocol context across views | Partly | Adapt older consumers to existing conservative replay; prospectively capture missing events | [history.ts][history] `healthStateAtDate`; [overlay.ts][overlay] `contextAtDate`; [Structured events migration][events-sql] `save_protocol_with_events_v1` | Historical parity fixtures and explicit gaps | Inventing deleted or unrecorded history | NEXT |
| Select priority and reconcile multiple facts | Partly | Deterministic finding reasons and concise briefing | [biomarkerIntelligence.ts][bio] `labIntelligence`; [evidence.ts][evidence] `ContextFact` production; [report/model.ts][report] trend ordering | Typed facts, disclosed limits | Priority mistaken for medical urgency | NEXT |
| Re-enter predictable import metadata / fix repetitive parsing errors | Partly | Tested provider adapters and ambiguity-focused review | [labImport.ts][import] `detectColumns`, `parsePdfLines`, `mapCsv`; [labEditor.ts][editor] `duplicateRows`, `prepareLabSubmission` | Representative failures and provenance | Wrong panel date or alias silently accepted | NEXT |
| Manually assemble a clinician report's history | Mostly | Consume shared findings and state in current report | [report/service.ts][report-service] `createDoctorReportFromSource` | Lab facts; historical consolidation for regimen claims | AI summary diverges from deterministic report | NEXT |
| Navigate many intervention events | Yes, presentation only | Identity-preserving primary protocol/episode grouping, secondary event choice | [presentation.ts][presentation] `protocolChangeOptions`, `protocolChangeUrl`; [manage/page.tsx][manage] `continued_from_protocol_id` | Explicit identity links | Blends or episodes merged by name | NEXT |
| Determine whether enough follow-up exists | Partly | Explain dates, missing same-unit pairs, and incomplete windows | [engine.ts][engine] `EvidenceStrength` reasons and `limitations`; [evidence.ts][evidence] gaps | Shared gap contract | Turning a data gap into a prescribed testing schedule | NEXT |
| Scan-derived or unusual health documents need transcription | Partly | OCR/document parsing with original-source review | [pdfImport.ts][pdf] `extractPdfText`; [labImport.ts][import] `parsePdfLines` | Evaluation set, source handling, consent for external processing | Extraction error; larger privacy scope | LATER |
| Manually enter a protocol from outside text | Partly | Draft structured fields; user confirms identity, timing, and dosing meaning | [dosingEntry.ts][entry] `entryFromForm`, `interpretEntry`; [protocolMutations.ts][mutations] `saveProtocolWithEvents` | Import schema and consent-specific provider boundary | Misclassifying syringe units as medication IU | LATER |
| Repeatedly ask Analyst after a new panel | Partly | Recompute deterministic briefing; optionally request consented synthesis | [analyst/service.ts][service] `analyzeHealthContext`; [aiConsent.ts][consent] `hasCurrentAiConsent` | Stable facts, source-change invalidation, rate limits, consent at execution | Silent sharing, stale or repetitive conclusions | LATER |
| Future wearable/lifestyle/EHR synchronization | Not within this foundation | Evaluate separate connectors and source-specific models later | Existing lab-only [measurements.ts][measurements] `normalizeMeasurements` is a boundary, not an integration hook | Native/integration permissions, data semantics, provenance | False cross-domain comparisons and privacy expansion | DEFER |

### The one recommended foundation

**Name:** Shared Lab Evidence V1.

**Problem:** The same recorded labs are translated into pair comparisons, range statements, and priorities differently by different consumers. Full historical sequences remain mostly chart data, so users or AI must assemble context that deterministic code could supply once.

**Current code reused:** [labs.ts][labs] `LabObservation`, `BiomarkerHistory`, `biomarkerHistories`; [biomarkerIntelligence.ts][bio] `classifyBiomarker`, `compareLatest`; [longitudinal/measurements.ts][measurements] `normalizeMeasurements`; existing source references, same-unit restrictions, and loading/auth boundaries.

**Current code consolidated:** Measurement eligibility and arithmetic between `compareLatest` and [engine.ts][engine] `observation`; transition/panel-membership facts and percentage-based ordering inside [evidence.ts][evidence] `buildAnalystContext`; corresponding typed comparisons in [report/model.ts][report] `buildDoctorReport`. Preserve distinct consumer windows and presentation needs. Replace prose parsing with numeric fields; do not rewrite historical state or confounders.

**Why foundational:** Labs, longitudinal observations, Analyst, and Report already depend on this information. One reusable evidence contract unlocks richer interpretation without new input or provider calls. It is smaller than a canonical whole-person-state redesign and more broadly useful than another filter.

**Dependencies:** Existing imported/manual results; conservative alias registry; exact-unit grouping; source IDs/dates; explicit current comparison policies; synthetic parity fixtures. Missing assay information becomes a declared limitation, not a guessed match. Valid same-unit arithmetic is not a certificate of assay equivalence.

**Unlocks:** Reliable latest/previous/earliest and multi-reading facts; descriptive prior history; shared range transitions/data gaps; later ranked findings, briefing, protocol-aware context, and consistent Doctor Report/AI evidence. These downstream experiences are not all part of this project's release.

**Likely files/modules:** Existing `lib/health/biomarkerIntelligence.ts`, `lib/health/labs.ts`, `lib/health/longitudinal/measurements.ts`, `lib/health/longitudinal/engine.ts`, `lib/health/longitudinal/analyst.ts`, `lib/health/analyst/evidence.ts`, and `lib/health/report/model.ts`. If a separate owner improves cohesion, add one pure `lib/health/labEvidence.ts` module and make existing entry points delegate to it; never leave a parallel calculation engine. Extend `tests/labs-v2c.test.mjs`, `tests/longitudinal.test.mjs`, `tests/health-analyst.test.mjs`, `tests/doctor-report.test.mjs`; a dedicated `tests/lab-evidence.test.mjs` is reasonable. These are proposed future edits only.

**Migration required? NO.** Derive facts from existing records and preserve missing information as missing. No new persisted concept, cache, finding table, or historical rewrite. If later evidence requires structured assay capture, propose the smallest additive change separately; do not use speculative schema work to expand this project.

**In scope:**

- A typed result describing comparator eligibility, exclusions, contributing IDs, dates, units, supplied ranges/status provenance, source confidence where available, and explicit unknowns.
- Latest/previous/earliest comparisons, ordered recorded movements, and descriptive prior observed extent with date/count context. No inferred clinical baseline.
- Known-status range transitions and panel-membership facts; retain ambiguity for missing ranges and conflicting dates.
- Shared eligibility mechanics with explicit caller policies. Equal-valued duplicate handling must preserve all provenance and cannot treat value equality alone as assay equivalence. Existing intervention windows, same-day timing exclusion, and historical state remain unchanged.
- Consumer adapters using typed deltas rather than regexes over prose. Characterize existing output before switching; intentional eligibility corrections need explicit regression cases.

**Out of scope:** UI redesign, hierarchical filters, new HealthBriefing screens, full ranking product, new AI behavior, protocol-history repairs, dosing changes, schema/migrations, alias expansion without evidence, generic unit conversion, OCR, new integrations, journal-derived longitudinal metrics, and proactive delivery. Advanced stable/step-change labels wait for defensible rules; do not invent clinical thresholds.

**Success criteria:**

1. The same eligible source pair yields identical arithmetic, source references, and declared limitations across consumers. Window selection remains an explicit input, not an accidental difference.
2. Unknown prior status cannot become “previously in range”; duplicate/conflicting dates, missing units, qualitative values, zero denominators, non-finite arithmetic, and assay uncertainty have explicit tested outcomes.
3. A multi-date fixture can produce a dated sequence and prior-history context without AI or user reconstruction. Prior extent excludes the current reading and reports how many earlier dates support it.
4. Every generated fact can identify its source observations. Different protocols, phases, events, episodes, and blends remain distinct; no journal field changes a Protocol Changes result.
5. Existing historical/dosing, consent, limiter, and deterministic-report fallback tests continue to pass. Add cross-consumer parity fixtures; run full tests, TypeScript, focused lint, and build in the eventual implementation.
6. No duplicate records, new tables, provider payload expansion, or extra per-intervention queries. Existing consumer presentations remain usable without AI.

**Main technical risks:** Existing duplicate-date and percentage policies differ; naïve unification can silently change results. Range/status provenance and assay absence can make seemingly numeric facts misleading. Source caps and mutable imported values limit historical claims. Small adapters and fixture-based parity checks are preferable to replacing modules wholesale.

**Main product risks:** A backend-only refactor could ship no user benefit; require visible consistency in existing comparison/report output and useful typed multi-date facts, without a redesign. Users may read priority, familiar history, or temporal association as a medical judgment. Keep descriptive language, evidence access, and limits attached to facts.

### Adversarial review

**A. Strongest argument that this is the wrong next project**

The data may be the bottleneck, not another derivation layer. [biomarkerIntelligence.ts][bio] `compareLatest` is already reused by Labs, Analyst, and Report, while [engine.ts][engine] already computes repeated before/after comparisons. The visible problem could be solved by presenting those existing facts better. Meanwhile [pdfImport.ts][pdf] cannot recover scanned text, `parsePdfLines` requires review and lacks wired provider adapters, and [labs.ts][labs] has no typed assay metadata. Richer trajectories over insufficiently characterized measurements could create more convincing but less trustworthy output.

The historical case is stronger still: [manage/page.tsx][manage] `reactivateProtocol` clears completion without an event, and [Structured events migration][events-sql] `save_protocol_with_events_v1` does not record every boundary/preparation/removal change. Improving prospective source capture first would prevent ongoing information loss that no later algorithm can repair. The repository lacks usage/import-failure evidence proving lab fact consistency is the largest day-to-day burden.

**B. Why choose it anyway**

This proposal earns its place by consolidating, not duplicating, `compareLatest`. The code shows actual policy divergence, not merely theoretical cleanliness: duplicate handling differs in `observation`; Analyst ranking parses prose; locally generated transition facts can interpret prior `unknown` as newly flagged and bypass comparison eligibility; Doctor Report orders a separate projection. Those problems affect already loaded data across working surfaces. A typed contract can expose unknown method/provenance and prevent overstated transitions immediately, without claiming to recover missing history.

Prospective event-capture repair remains a gate before expanding historical protocol synthesis, but it does not repair fragmented lab facts. Import/OCR work cannot improve interpretation of the user's already recorded history. A filter alone improves navigation, not factual consistency. Choose the bounded lab foundation first, followed by evidence-led source/history repair before wider automation. If initial parity fixtures show source ambiguity eliminates most useful comparisons, stop expanding trajectory outputs and move the unresolved compatibility-capture work into the next approved project; do not loosen eligibility to justify this recommendation.

## NEXT

After the shared facts meet acceptance criteria, consolidate older historical-context consumers onto [history.ts][history] `healthStateAtDate` with completion-date and same-day parity fixtures. Audit prospective mutation coverage separately: reactivation, removed compounds, preparation-only edits, and boundary edits. No historical backfill by inference.

Then use existing derived `HealthVersion` and protocol states plus lab facts to support a small deterministic finding/priority layer, coverage gaps, and a concise HealthBriefing. Doctor Report should consume that same evidence; preserve [report/service.ts][report-service] deterministic fallback. Protocol-aware synthesis waits for the historical gaps to be explicitly handled. Flat event selection can then receive identity-preserving progressive disclosure as a contained UI task.

Prioritize import adapters/reconciliation only for documented high-frequency failures. Preserve [labEditor.ts][editor] review and [Labs V2 migration][labs-v2-sql] source guards. Do not automatically save ambiguous records or relax confirmation simply to reduce clicks.

## LATER

Broader document/OCR ingestion, AI-assisted protocol drafts, richer personal-history patterns, and follow-up intelligence need evaluated source handling and clear evidence boundaries first. Any future assay/specimen capture should be justified by real comparison failures and added to the existing source model rather than a parallel record system.

Proactive briefings should recompute deterministic facts from changed sources, avoid duplicate notifications, disclose missing evidence, and invalidate stale conclusions after corrections/deletions. Optional AI execution must check current consent at execution time, respect revocation and provider scope, and retain durable rate limits. Existing [aiConsent.ts][consent], [analyst/service.ts][service], and [durableRateLimit.ts][limiter] remain the boundaries. No silent upload of additional journal notes or source documents.

## DEFER

Apple Health, broad wearable ingestion, activity/sleep/nutrition intelligence, EHR integration, and complex notifications are outside the immediate longitudinal foundation. They require new permissions, provenance, source-specific comparison rules, and delivery behavior; the current [measurements.ts][measurements] lab-only normalizer is not an appropriate generic destination.

A universal patient-state database is not justified by this audit. Never treat saved AI findings as truth, infer causal treatment effects from these personal timelines, or correct historical doses automatically. Preserve manual fallback and existing Journal/Timeline behavior. This strategy run ends here with one recommendation; implementation requires a separate explicit approval.

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
