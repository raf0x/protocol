# Longitudinal timeline

The existing `/timeline` route and authentication proxy are preserved. No database writes, migrations, dependencies, or changes to `/protocol` are included.

## Changed files in this revision

- `lib/health/timeline.ts`: natural action titles, exact repetitive-text removal, structured protocol metadata, conservative duplicate suppression, baseline derivation, saved-plan chips, and month/day grouping.
- `lib/health/loadTimeline.ts`: expands existing protocol-event relations to protocol start/status and compound phases; adds a user-scoped, paginated protocols read for the baseline. Returns `{ events, baseline }`.
- `app/timeline/page.tsx`: compact Current Baseline card, month and date sections, and saved-plan chips. Keeps all five filters and Labs/loading/error/retry/empty states.
- `app/timeline/timeline.module.css`: scoped baseline, grouped history, and chip styles using existing CSS variables and mobile max-width.
- `tests/timeline.test.ts`: regression coverage for normalization, enrichment, phase ranges, duplicate identity, baseline, and date grouping.
- `docs/timeline.md`: explains behavior, source limitations, and validation.

## Data and historical accuracy

Events still originate only from `protocol_events` and `journal_entries`. A journal row may produce separate Weight and Journal entries with shared source identity and distinct timeline IDs. Weight remains in pounds, matching existing storage. Baseline uses the latest non-future weight with its recorded date, exact `active` protocol status, compound records belonging to those protocols, and the newest non-future protocol-event date. The baseline is independent of the selected filter and does not infer activity from event names.

Enrichment uses an event's linked compound, or the protocol's sole compound when the event has no compound ID. Multi-compound protocol events are not arbitrarily assigned one compound's dose. A phase is selected only when exactly one saved week range covers the event date relative to protocol start. Missing dates, overlapping ranges, and dates outside all ranges produce no dosing context.

The protocol editor replaces phases, so their values are mutable saved-plan context, not verified historical doses. Chips are explicitly labeled “Saved plan.” Original free text and recorded dosing remain visible, even when different from the saved plan. Metadata includes compound name, dose, dose unit, frequency, protocol start date/status, phase identity, and provenance. Route is optional in the normalizer, but no persisted route field is established by this repository, so the loader does not request a speculative column or infer an administration route.

## Duplicate policy

Names never establish identity. Suppression requires the same non-null protocol ID, compound ID (including null), exact action/date, equivalent whitespace/case-normalized description, and identical related details. Unlinked events require the same source ID. Repeated identical journal source rows are suppressed; different journal IDs remain distinct. Different protocol IDs, compound IDs, dates, actions, or descriptions stay separate. No medical or semantic inference is performed, including for similarly named blends and standalone compounds.

## Validation

Run `node --test tests/timeline.test.ts` with Node 24, `npx eslint app/timeline lib/health tests/timeline.test.ts`, and `npm run build`.

The repository's full lint baseline is 520 errors and 79 warnings in existing files. This revision does not change lint rules or unrelated files. Production build verification uses disposable VAPID keys and placeholder Supabase configuration in the build process environment because the supplied archive has no credentials. No environment files are included.

Live authenticated Supabase verification remains required before release. In particular, verify the expanded nested relation query and populated states with the project's RLS policies. No deployment was performed.

## Structured Current Baseline revision

The baseline now renders a compact protocol list in place of compound chips. Each protocol retains its own identity and shows its name, active status, start date, and current week when derivable. Each associated compound shows its name and available dose/unit/frequency/route. Fields without reliable values are omitted. Weight and its recorded date are unchanged. The latest recorded protocol change now includes the normalized event title.

The protocols query includes phases. Current phase selection uses today's local calendar date against the protocol start date and inclusive phase week ranges. It shares phase selection, metadata extraction, and formatting with timeline enrichment. Exactly one phase must cover today; expired, future, overlapping, or undated phases do not supply a current dose. Week numbers are one-based elapsed protocol weeks, not injection counts or phase weeks, and are omitted before the start date. No phase is extended automatically.

Protocols sort by start date descending, then protocol ID; missing starts sort last. Compounds sort by name then ID within each protocol. This keeps blends together and similarly named protocol records separate. The schema does not establish a route column, so route remains omitted unless provided to normalization as explicit structured data. No route is inferred from compound names or notes.

Files changed: `lib/health/timeline.ts` (baseline types/derivation and shared phase helpers), `lib/health/loadTimeline.ts` (baseline phase query), `app/timeline/page.tsx` (compact protocol list and last-change title), `app/timeline/timeline.module.css` (wrapping and scoped row styles), `tests/timeline.test.ts` (12 total tests), and this document. `/protocol`, authentication, filters, Labs, dependencies, and schema are unchanged.

Validation: all 12 tests and changed-file lint pass. Full lint retains the existing 520 errors and 79 warnings. Production build passes with temporary VAPID/Supabase configuration; real authenticated database verification remains outstanding.

## V3.1 focused refinement

The baseline no longer repeats “Active” beside every protocol. The existing hierarchy, weight, active count, protocol list, last event, filters, and historical cards remain intact.

`resolveBaselineDetails` uses the existing unique-current-phase selector and shared display formatter. Resolution order is current phase medication dose, then protocol medication dose, then phase/protocol volume or stored `ml_per_dose`. Protocol-level fallback is only allowed for a single compound or a protocol without compounds, never shared across a blend. Invalid/nonpositive doses are omitted.

Medication mass units (mg/mcg) remain unchanged. IU is treated as medication IU when the vial is explicitly IU-labelled. In this repository's established convention, IU on a mass-labelled vial represents U-100 syringe markings: divide by 100 for mL, then multiply by vial strength / BAC water mL only if those values and units are valid. Explicit syringe `units` also use the existing U-100 convention. Known volume without concentration displays mL. Ambiguous IU without a supporting vial unit is omitted. No name-based conversion or mass-to-medication-IU conversion occurs. Current vial information is used only for baseline resolution, not historical event enrichment.

Structured rolling frequency takes precedence over weekday selections; valid unique weekday selections determine weekly frequency, followed by recognized frequency strings. Route displays only recognized explicit structured IM/intramuscular or SubQ/SQ/SC/subcutaneous values. Free text is not parsed.

The baseline loader reads complete existing protocol/compound/phase rows to accept optional `dose`, `dose_unit`, `frequency`, `days_of_week`, and `route` fields without requesting nonexistent columns. This does not add fields to the database. The supplied editor establishes no protocol-level dose or route storage, so those fallbacks only work if present in the actual database. Missing current phases still require other explicit stored dose/volume data; expired phase values are not extended automatically.

Files changed: `lib/health/timeline.ts`, `lib/health/loadTimeline.ts`, `app/timeline/page.tsx`, `app/timeline/timeline.module.css`, `tests/timeline.test.ts`, and this document. All 16 tests and changed-file lint pass. Full lint retains its pre-existing issues. Production build passed using temporary environment configuration. Live user data was unavailable, so no claims are made about which named protocols now have sufficient metadata.

## Dosing Semantics V1 supersedes V3.1 dose inference

Current Baseline now displays only an explicitly reviewed current phase's medication dose. It never substitutes a compound volume, syringe markings, an expired phase, or a protocol-level guess. Legacy phase rows keep a null `dose_semantics_version` until manually reviewed, and show a review link instead of an inferred medication dose. History records are not repaired or merged. See `docs/dosing-semantics-v1.md` for migration, field meanings, changed save paths, and deployment instructions.
