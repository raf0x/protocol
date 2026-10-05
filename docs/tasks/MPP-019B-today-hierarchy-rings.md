# MPP-019B — Today hierarchy and rings

Presentation-only follow-up to MPP-019A. Low-risk composition and scoped styling; independent review is optional for this gate. No release authorization.

Acceptance: greeting/date, centered Active Protocols rings hero, visible selected snapshot immediately below the rings, compact Focus, inline Daily check-in, Schedule / logs, Health trends. Remove the redundant tall protocol list. Keep all active rings, grouping/overlap, colors, accessible selection and snapshot data/visual/actions. Increase ring stroke/glow/text presence. Keep Recent Changes and All doses today absent.

Preserve all calculations, semantics, save/logging/confirmation/persistence/backend behavior, daily check-in prompt/modal, scheduling, inventory and bottom navigation. No logic changes are required. At intake, recorded hashes for all 65 existing dirty/untracked files in a temporary preservation manifest. Limit edits to Today composition/styles, expectations superseded by this presentation change, the corresponding browser fixture and this handoff. Do not stage, commit, push or deploy.

Validation: directly relevant focused Today tests, TypeScript and `git diff --check`. No full regression or build. No browser execution is planned; visual appearance remains an owner QA gate. Existing behavior assertions stay intact; removed-row tests retain selection/coverage and management checks through the rings/snapshot.

Implemented the target order on desktop and mobile: greeting/date → Active Protocols rings and snapshot → Focus → Daily check-in → Schedule / logs → Health trends. Removed the tall selectable list without adding another selector. Existing rings remain the primary controls, with all active compounds and their selection/fallback/color/grouping behavior preserved.

Today-scoped ring styling now uses a centered cluster up to 456px (previously 420px), 4px borders (previously 2px), restrained per-protocol outer/inner glow, stronger selected outline/halo, bolder 14–18px names and higher-contrast 13–15px week text. Shared ring components and management/editor styles were not edited. Grouping, overlap, keyboard buttons, accessible full names and reduced-motion handling remain intact.

The existing snapshot is the next child directly beneath the rings, with tighter separation and fact-grid spacing. Its nine facts, dose summary, vial SVG, Manage/Inventory links and vial/phase/confirmation controls are unchanged. Focus uses less padding, smaller dose/name type, a compact non-wrapping support row and a short desktop grid; its component, callbacks, ordering, progress and error handling are byte-identical to intake. The approved check-in component, prompt state and page data/action wiring are also byte-identical.

Changed files for MPP-019B only:

- `components/today/TodayOverview.tsx`: hierarchy and linear secondary sections.
- `components/today/ActiveProtocolList.tsx`: rings with directly connected snapshot; removed redundant rows.
- `app/protocol/today-v2.module.css`: scoped ring visuals, snapshot spacing and compact Focus styling.
- `tests/today.test.mjs`: superseded hierarchy/row expectations now checked through rings and snapshot.
- `tests/today-v2.test.mjs`: ordered section composition, no duplicated list, ring selection/coverage/colors and connected snapshot.
- `tests/today-v2.browser.cjs`: update future visual fixture expectations to the new hierarchy; not executed.
- `docs/tasks/MPP-019B-today-hierarchy-rings.md` (new): scope and validation handoff.

Validation:

- `npm run validate:focused -- tests/today.test.mjs tests/today-dose-order.test.mjs tests/today-v2.test.mjs tests/today-checkin-prompt.test.mjs`: **41 passed, 0 failed, 0 skipped**. Includes preserved dose logging/error/navigation, native prompt lifecycle, snapshot values/missing states and completion confirmation.
- `npm run validate:types`: **PASS**.
- `git diff --check`: **PASS**, exit 0.
- Preservation hashes: **59 of 65** pre-existing dirty/untracked files remain byte-identical. The six differences are exactly the intended existing files above; one new task packet added. No unrelated edits. No dose/semantics/schedule/inventory/health logic, save/logging/confirmation/modal/persistence/backend/API/Supabase/schema/migration or navigation behavior edits. No staged files, commit, push or deployment.

No full regression, build or browser run. The updated browser fixture is pending execution; visual prominence, exact responsive height and glow appearance remain unverified by a browser. Owner visual QA is the remaining presentation acceptance gate; earlier MPP-019/019A screenshots are not evidence for this revision.
