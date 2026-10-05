# MPP-017 — Dosing semantics completion

## Outcome and risk

- Business outcome: create and edit preserve medication dose, syringe markings, syringe scale, injection volume, and preparation as distinct facts while allowing valid partial information to save.
- Risk: high. This changes medication-related interpretation and presentation, but does not change lifecycle, inventory, ownership, schema, or migrations.
- Architecture: `Compound` draft → `protocolCompoundPayload` → `entryFromForm` → raw validation → `saveProtocolWithEvents` / `save_protocol_with_events_v2` → `phases.dosing_entry` → shared interpretation and presentation helpers.

## Decisions

- Raw validity is separate from calculation availability. Non-finite and negative values, malformed dates/identifiers, missing names, and new unsupported syringe scales block; incomplete interpretation does not.
- U-100 and U-40 are the only interpreted syringe scales. New syringe entries default to U-100. An unsupported historical scale remains visible and can round-trip unchanged, but it is not used for calculation.
- Syringe capacity is not persisted and never changes scale conversion. U-100 divides markings by 100; U-40 divides by 40.
- Medication IU is compatible only with IU concentration. Mass units may convert only by the deterministic `1 mg = 1000 mcg` relationship. Compound names never supply concentration.
- Selected phase preparation is authoritative for calculation. Hidden or conflicting preparation facts remain saved and produce guidance rather than being silently selected.
- Derived overflow drops the derived result and produces guidance; valid entered quantities remain saveable.
- When medication dose is unavailable, displays include known administration facts and the exact text `Medication dose not calculated.` Unresolved meaning also includes `Unverified dose semantics`.
- The create API retains medication-shaped request compatibility and maps explicit modes through `quickEntryPayload`; it uses the current `save_protocol_with_events_v2` wrapper.

## Scope and preservation

Implementation is limited to the approved dosing helpers, protocol create/edit UI, protocol presentation, create API, calculator wording, focused tests, and this task packet. No Supabase schema or migration is introduced.

Preserved boundaries:

- No lifecycle, scheduling, date, inventory, ownership, or event-generation redesign.
- No Timeline, Health, Analyst, Doctor Report, landing, or demo implementation changes.
- Existing unrelated work in `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, and `supabase/.temp/` is untouched.
- No staging, commit, push, deployment, or Supabase mutation is authorized.

## Acceptance criteria

- [x] Medication, syringe, volume, and unknown modes accept valid partial create/edit saves.
- [x] U-100 converts 18/25/50 markings to 0.18/0.25/0.50 mL; U-40 divides by 40; capacity does not affect conversion.
- [x] New syringe drafts visibly default to U-100; historical U-40, blank, and unsupported scales are preserved without reinterpretation.
- [x] Medication IU never converts to mass, and syringe markings never become medication IU.
- [x] Missing, stale, conflicting, and unknown preparation preserves raw facts and yields guidance.
- [x] Derived overflow does not discard or block finite raw input.
- [x] Legacy hydration retains administration facts, review state, and exact stored text; phase changes do not leak another phase's preparation.
- [x] Medication dose remains primary when known; missing medication and unresolved semantics are explicit in shared displays.
- [x] The create API keeps legacy medication requests and accepts explicit canonical modes.
- [x] Calculator wording distinguishes U-100 scale from syringe capacity.
- [x] No migration or schema change is present.

## Correction round 1

- Editable drafts now have one authoritative confirmation value: `reviewed`. Hydration converts the saved historical status into that value once, explicit unchecking wins, and changes to dose, administration, concentration, or preparation invalidate confirmation.
- Reconstitution handoff now explicitly selects `mixing`, retains the compound's medication unit, clears stale labelled concentration fields, and resets confirmation. Complete mixing facts calculate; incomplete facts remain saveable with guidance.
- Interpretation retains entered injection volume and syringe markings for every mode. Medication remains the primary dose in medication mode, while disagreements with administration facts preserve both values and mark the interpretation unverified with conflict guidance.
- Focused path coverage now exercises all four modes through create and edit/reopen, the real POST handler boundary, overflow submission/reopen, unsupported historical scale round-trip, and confirmation/preparation isolation across phases and new phases.

## Correction round 2

- The create API accepts confirmation only from an explicit current `reviewed=true`; legacy `review_status` input is treated as historical metadata and cannot confirm or promote an unknown-mode dose.
- Reconstitution handoff keeps a selected V2 phase's vial unit authoritative. Compound-level unit is used only when that phase has no unit, with no compound-name inference.
- Interpretation reports administration conflicts explicitly. The edit review suppresses calculation equations whenever preserved facts disagree and shows unverified guidance; non-conflicting equations continue to use one consistent set of operands and result.

## Validation

- Round 2 focused corrections: `npm run validate:focused -- tests/dosing-entry.test.mjs tests/protocol-creation.test.mjs tests/create-protocol-api.test.mjs` passed 3 files and 54 tests: 54 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo.
- Focused tests: `npm run validate:focused -- tests/dosing-entry.test.mjs tests/protocol-quick-start.test.mjs tests/protocol-creation.test.mjs tests/protocol-numeric-display.test.mjs tests/protocols.test.mjs tests/timeline.test.ts tests/protocol-save-dates-sql.test.mjs tests/structured-events.test.mjs tests/calculator-capacity.test.mjs tests/create-protocol-api.test.mjs` passed 10 files and 150 tests: 150 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo.
- TypeScript: `npm run validate:types` passed.
- Diff whitespace: `git diff --check` passed; Git emitted only the repository's CRLF conversion notices.
- Broad regression and production build: intentionally deferred to the Delivery Lead release gate.
- Browser/manual QA: not run during this implementation pass; create/edit/reopen, U-40, unknown mode, and keyboard operation remain review targets.

## Rollback and release

Rollback is the ordinary reversal of the scoped application and test changes; no data rollback or migration reversal is needed because raw JSON remains authoritative and no schema change was made. Deployment is not authorized in this task.
