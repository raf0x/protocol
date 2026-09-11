# MyPepProtocol UI Modernization Phase 2: Protocols

## Route and navigation

Protocols remains at /protocol/manage. Existing query links for editing a protocol/compound, calculator prefills, and adding a phase remain supported. No bottom-tab routes changed. Today, its ring selector, Timeline and Health were not redesigned.

## Files changed

Modified:

- app/protocol/manage/page.tsx: composes the library and detail experience, groups existing editor fields, preserves existing handlers and payloads, and mounts native confirmation dialogs.

Added:

- app/protocol/manage/protocols.css: route-scoped styling using existing Phase 1 --app-* tokens.
- components/protocols/ProtocolLibrary.tsx: Active and Completed sections, counts, empty states and selection support.
- components/protocols/ProtocolCard.tsx: scan-first protocol cards, including all compounds in multi-compound protocols.
- components/protocols/ProtocolDetail.tsx: overview, schedule, administration/preparation/inventory disclosures and read-only history.
- components/protocols/PhaseCard.tsx: current/final phase, phase history and existing continuation action.
- components/protocols/EditorSection.tsx: reusable visible fieldsets and optional disclosures.
- components/protocols/ProtocolDialog.tsx: native modal confirmation wrapper with keyboard dismissal and focus containment.
- lib/health/protocolPresentation.ts: read-only display adapter calling existing dose, schedule and phase helpers. No conversion formulas changed.
- tests/protocols.test.mjs: 11 new presentation/regression tests.
- UI-MODERNIZATION-PHASE2.md: this report.

## Landing and detail

The landing screen has a Protocols title, Add Protocol action, Active and Completed sections. Cards show real current dose, frequency, route, week/status and the next saved scheduled day within the next eight calendar days when available. “Scheduled” describes the saved plan, not whether an injection was taken. No exact clock time is invented.

Completed cards are quieter, with saved start/completion dates, elapsed days and a completion-date dose only when a saved phase covers that date. Unknown final dosing is not guessed from an expired phase.

Selecting a card opens a detail layout within the existing route. Current dose and schedule come first. Administration, preparation, inventory/notes, and history are collapsed. Edit, Complete, Reactivate and Delete remain available. The detail view reads up to 50 recent protocol events and 50 recent taken injection logs. Existing records are not modified by viewing.

Library tools retain CSV export and multi-delete. Destructive actions retain confirmation. Reactivate/Complete/Delete use the existing page handlers.

## Editor and phases

The same editor controls, state, validation and save payload are grouped into:

1. Medication, including the existing medication/syringe/volume/unknown entry selector.
2. Schedule.
3. Administration, collapsed.
4. Preparation, collapsed.
5. Phase.
6. Inventory & notes, collapsed.
7. Review with existing advisory calculations.

The dosing entry selector remains together so users can enter what they know. Syringe scale and route are grouped in Administration; preparation data stays in its own disclosure. Fields are not removed or made required. “Reconstitution date” no longer has a misleading required asterisk; validation itself is unchanged.

Save is sticky above the bottom tabs. The existing fast path can save incomplete information without opening optional sections.

Phase selection and ongoing duration use the existing implementation. Current phase display calls strict currentPhase(). Expired latest phases show “Latest phase ended” with Continue latest phase and Add new phase. Continue calls the same continue_latest_phase RPC with protocol/compound/phase IDs as the existing Today hero. Add phase uses the existing management initialization path. No phase dates are changed automatically.

## Mobile and accessibility

- 760px centered maximum width, matching the mobile-app language on desktop.
- Cards and details use the existing surfaces, radii, accent and typography tokens.
- Long names/values wrap; inputs have readable 16px text.
- Buttons and form controls have 44px minimum targets; Save is 48px.
- Weekday buttons wrap into four columns on narrow screens, returning to seven on larger screens.
- Native disclosures, fieldset/legend groups, descriptive input labels, pressed-state schedule buttons, visible focus outlines and native confirmation dialogs.
- Existing global safe-area shell stays intact; Save clears the bottom tabs and safe area.
- Light/dark input color schemes follow the current theme.

## Validation

- Standalone TypeScript: passed.
- Production build: passed, including Next.js TypeScript validation, using temporary build-only configuration.
- New components, read-only presentation adapter and Protocols tests: focused ESLint passed.
- Management page: 10 pre-existing no-explicit-any errors and one existing exhaustive-deps warning remain. Baseline had 12 any errors, one unescaped-entity error and the same hook warning. No new lint category was introduced.
- Suite: 66 passed, zero failures, seven optional SQL tests skipped because the previously temporary PGlite dependency is absent. An initial attempt with the stale PGlite path failed to load that test dependency; rerunning with the tests' normal optional-dependency behavior produced the stated result. No SQL was changed.
- Eleven new tests cover current vs first phase, expiration, next scheduled day, completed dosing, raw syringe entries, empty groups, multi-compound cards, detail disclosures/actions, completed-phase safeguards, optional editor sections, and preserved save-first RPC usage.
- Source comparison confirmed the existing load, save, complete, reactivate, completed-delete and bulk-delete handlers are unchanged.
- Browser/device verification was not completed. No live production saves, migration execution or historical-data correction was performed. The previous browser-preview compatibility limitation remains.

## Scope confirmation

No migration required. No schema, existing dosing semantics/formulas, currentPhase(), phase persistence rules, authentication, API routes, Timeline or historical-record changes. Added only presentation adapters, read-only history access and a UI entry point to the existing continuation RPC.

## Remaining UX gaps before Timeline redesign

- Verify the complete editor and confirmation dialogs on an actual iPhone, including larger text, keyboard-open Save behavior, long compound names and light mode.
- Detail history is a recent-entry view, not a complete historical analysis screen; it retains all older records but displays at most 50 entries of each type.
- Unknown or ambiguous legacy doses remain calmly labelled instead of inferred.
- Timeline intentionally retains its current presentation until its own redesign.
- Existing management-page typing/lint debt and existing mutation-error handling were not broadened into this UI task.
