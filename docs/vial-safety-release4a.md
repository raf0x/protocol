# Release 4A: vial safety and recovery

Status: local implementation only; no staging, commit, deployment or database changes.
Baseline: fbd2b6b9c9a0f6013fe0fba93afdafbba7874ff7.
Branch: fix/vial-safety-recovery-r4a.

## Scope and acceptance

This release contains the P0 audit's misleading active-vial information and unsafe replacement operation. It does not introduce vial history, a new dosing engine, clinical recommendations, migration, backfill or changes to historical treatment records. Independent architecture and source review completed before the final validation gate.

- Reconstitution is an observation, not an expiration calculation. Today and Protocol show unknown current-vial expiration. Inventory retains explicitly recorded expiration dates with a source-specific label. The cron route no longer sends reconstitution-plus-28-day expiry alerts; journal reminders remain.
- Existing interpreter warnings become field-specific explanations and recovery links. Medication/volume and markings/volume conflicts, missing or unsupported scale, preparation conflicts or omissions, incompatible units, invalid records and unknown legacy semantics remain unresolved until explicitly reviewed. No value is cleared and a calculation is not clinical confirmation.
- Recorded compound preparation is labelled separately from saved phase preparation. Equivalent mg/mcg amounts compare without false conflicts; comparisons retain raw precision and never equate IU with mass.
- Remaining volume is unknown for every legacy active-vial record in this release, including a valid dose and recorded counter. The model has no physical-vial linkage for logged doses or confirmed starting balance. Missing date/liquid facts and preparation disagreements are explained in addition to that attribution limit. No historical doses or zero/default counters establish a remaining volume. The premium vial artwork remains.
- Null stock remains unknown; zero remains a recorded zero. Reading and rendering do not reorder the phase arrays or write historical data.

## Exact New Vial containment UX

The existing + New Vial control opens a keyboard-accessible modal titled "Starting a new vial is temporarily unavailable". It explains that replacement is paused until each vial can be saved separately and that stock, preparation details and dose counters have not changed. Close returns focus to the trigger. View protocols opens the existing protocol list. Escape and Tab focus containment are supported.

Opening the modal performs no Supabase read or write, stock decrement, counter reset, date save or replacement redirect. Old URLs containing the reconstitution handoff parameters are intercepted before the editor opens: the page explains the restriction and retains access to the existing protocol detail. Both former direct-save and editor-redirect paths are therefore contained.

Ordinary protocol editing, history viewing and dose logging remain available. Recovery opens the correct compound and control without saving. If a legacy record requests a concentration field hidden by its existing preparation controls, focus moves to Preparation source and a notice identifies the requested field and retained value; the preparation choice is not changed. An invalid historical measurement mode receives focus without selecting an option.

## Data and compatibility limits

The dosing interpreter, form hydration and protocol save helpers are unchanged. Existing editor defaults remain a separate legacy risk: opening a legacy editor can display pre-existing fallback values for blank fields. This release does not certify all existing edit/save semantics or repair previously persisted records. Recovery navigation itself is tested as non-mutating. No U-100 scale, unknown stock or expiration is backfilled.

Explicit inventory expiration is not linked to a physical active vial in the current schema. It remains on the inventory item and is never copied to Today or used to create an active-vial alert. No new beyond-use field or storage interval is invented.

## Regression coverage

Synthetic unit/component tests cover null versus zero stock, missing and conflicting preparation, phase/compound disagreement, raw precision and mg/mcg equivalence, missing syringe scale, exact recovery fields, invalid dates, explicit inventory expiration versus unknown active-vial expiration, cron isolation, New Vial non-mutation and old URL containment. Frozen inputs and mocked stores verify preservation of old values and treatment history.

The browser harness renders actual HeroProtocolCard and ManagePage with synthetic records, blocked external requests and mocked backend operations. It checks 320px and 390px widths in dark/light, reduced motion, keyboard focus, exact-field recovery, modal containment and preserved histories. It is not an authenticated production or native App Store session. Evidence is outside this repository at ../MyPepProtocol-Vial-Safety-Release4A-Evidence/.

Existing assertions expecting inferred remaining volume/expiration, unsafe New Vial writes or generic review labels were replaced with the authorized safety behavior. Unrelated baseline tests were not weakened or changed.

## Release 4B dependencies

1. Durable physical-vial identity, immutable preparation/observation history and explicit linkage of each administration to its vial.
2. Atomic and idempotent replacement workflow, with separate unknown/zero stock semantics and preservation of prior-vial facts.
3. Confirmed starting balance and attributable consumption before any remaining-volume or empty-vial state.
4. Explicit expiration/beyond-use provenance linked to the correct vial before any expiry display or alert.
5. A separately reviewed legacy reconciliation/editing flow that preserves unknown fields and historical observations, and requires confirmation of dose meaning, route, schedule and syringe scale. No silent backfill.

Do not re-enable the replacement mutation or remaining-volume estimates until these invariants have a durable implementation and regression coverage.
