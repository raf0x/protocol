# MPP-019C — Today production presentation reconciliation

Presentation-only, low-risk follow-up to MPP-019B. Restore the preferred production patterns from Rafael's supplied comparison (right side = production) and Health Trends / Active Compound crops. Localhost screenshots show the superseded layout. Repository production-era markup provides the Schedule table and export/action styling; no Schedule screenshot was supplied. No live production access is available in this session.

Acceptance: compact Current Weight / Weight Change / Focus strip before the Active Protocols hero; focused 900–1000px content width; richer gradient and protocol-colored ring glow with selected lift; existing grouping, overlap and selection; cohesive Active Compound with week/start/dose pills, nine existing facts and vial; approved inline check-in and popup; restored Schedule and Health Trends presentation; no duplicate protocol list, large Focus or Recent Changes.

Preserve calculations, semantics, scheduling, inventory/lifecycle, health helpers, save/logging/confirmation/persistence, check-in trigger state, API/backend/Supabase/schema/migrations, editor and navigation behavior. Recorded 66 dirty/untracked file hashes before implementation and before-copies of the page and Hero for comparison. Only Today presentation, superseded presentation test expectations, future browser fixture expectations and this task packet may change. No staging, commit, push, deployment or Supabase authorization. Budget unspecified.

Required checks: relevant Today/dashboard focused tests, `npm run validate:types`, `git diff --check`. User's narrower gate excludes full regression, production build, release validation and browser execution. Owner visual QA remains pending. Independent review is optional for this presentation gate and was not requested; no separate reviewer used. Existing behavior assertions must remain intact. Stop any change requiring business logic or unrelated work.

Implementation:

- Header → compact three-card status strip → rings and Active Compound → approved check-in → original visible weekly table/actions → compact Health Trends → existing conditional content. Below 600px the weight cards share a row and Focus spans the next row; it remains part of the strip.
- Current Weight and signed Weight Change use unchanged `journalSnapshot`, `convertWeight` and `formatWeight`; keep the production 24px bold value, small unit/label/date, 8px gaps and 10px bordered cards. Native unit buttons expose recorded values to assistive technology. Missing/single weight observations never acquire an invented change.
- Focus is the third card, with existing pending-dose state/order/navigation/completion/error and logging callback. Display confirmed medication via existing `currentPhase` / `dosingDisplay` / formatting, unknown medication explicitly, and one short secondary review warning. The count announcement remains visually hidden for accessibility; the progress line remains. No dominant technical semantics string or duplicate Focus hero.
- A production-style dark gradient on the cohesive hero and subtle radial highlight behind the centered rings; 4px colored stroke, stronger inner/outer glow, 6% selected scale with 4px lift and higher stacking, colored halo, no selected white double outline or constant animation. Keyboard focus remains visible. Names 15–20px/800; week 14–16px/500. Geometry, partial-row centering, groups of three, all-ring visibility and native selection are unchanged. The prior removal of the redundant list stays intact.
- ACTIVE COMPOUND eyebrow, bold 24px name, colored week pill, existing Started date and medication pill with `/dose` only for interpreted medication. Nine existing facts remain immediately beneath the header, with the unchanged vial SVG on the right (80×160 desktop, 72×144 mobile) in the same section. Manage/Inventory and phase, completion confirmation and compact lifecycle/New Vial controls retain their callbacks.
- Container reduced from 1120px to 960px including gutters. No navigation edits.
- Schedule no longer sits inside the new disclosure. Remove MPP-019 CSS overrides on table borders/radius/text/controls and restore the production-era CSV / My Protocols button markup. `WeeklySchedule.tsx` is byte-identical to intake, including its parent log state, week navigation, table/day/indicator colors, export wiring and scheduling behavior. Exact current-live Schedule appearance still requires owner comparison because no Schedule screenshot was provided.
- Restore original Health Trends card/heading icon, Latest weight/date, 38px current value and unit toggle, signed dated change, existing decorative bars icon, three shaded Energy/Sleep/Mood cells with observation dates and Manage entries. Production-era source and supplied Health Trends crop contain the bars icon, not a data sparkline; no chart or health calculation added. Preserve semantic date elements and honest zero/missing values. Restore gradient/border/radius/shadow instead of the flattened MPP-019 card adapter. Card max width 480px.

Files changed in MPP-019C only (12):

- `app/protocol/page.tsx`: restore existing Schedule action presentation; all page data/calculation/save/check-in wiring unchanged.
- `app/protocol/today-v2.module.css`: status proportions, width, gradient/ring lift, Active Compound layout and removal of conflicting Schedule/Health overrides; popup styles unchanged.
- `components/today/TodayStatusStrip.tsx` (new): production-pattern recorded weight presenters and compact Focus slot.
- `components/today/TodayOverview.tsx`: requested order and direct Schedule rendering.
- `components/today/TodaysFocusCard.tsx`: compact presentation and separate medication/review text; original browsing/logging state and handlers preserved.
- `components/today/SelectedProtocolSnapshot.tsx`: Active Compound heading/week/start/dose presentation.
- `components/dashboard/HeroProtocolCard.tsx`: pass existing week/start/color/medication-known results to the presenter; all nine fact expressions and existing logic unchanged.
- `components/today/HealthTrendsCard.tsx`: restore production markup with existing values/date helpers.
- `tests/today.test.mjs`: superseded hierarchy expectation.
- `tests/today-v2.test.mjs`: superseded layout expectations plus weight/missing/conversion/unit actions and structured/legacy/unverified/malformed/conflicting Focus presentation; retain behavior coverage.
- `tests/today-v2.browser.cjs`: future fixture expectations updated for new hierarchy/restored Schedule/empty Health; not executed.
- `docs/tasks/MPP-019C-today-production-reconciliation.md` (new): scope, references, results and handoff.

Validation and preservation:

- `npm run validate:focused -- tests/today.test.mjs tests/today-dose-order.test.mjs tests/today-v2.test.mjs tests/today-checkin-prompt.test.mjs tests/protocol-numeric-display.test.mjs`: **61 passed, 0 failed, 0 skipped**. The initial run had one incorrect new expectation (`83` instead of existing formatter's `83.0` kg); corrected the test, preserving formatting, and reran successfully. No known baseline failures in these checks.
- Final status-button accessible-label refinement: `npm run validate:focused -- tests/today-v2.test.mjs`: **17 passed, 0 failed, 0 skipped**; standalone types rechecked and passed. No other runtime files changed after the 61-test pass.
- `npm run validate:types`: **PASS**.
- `git diff --check`: **PASS** (exit 0), including final documentation.
- Preservation manifest: **56 of 66** pre-existing dirty/untracked files byte-identical; the ten changed existing files are exactly the intended files above, plus two new files. Page calculations/data/saves and check-in wiring, Hero calculations/mutations/default markup/lifecycle/confirmation are identical to before-copies after line-ending normalization. Approved check-in component/prompt, WeeklySchedule, dosing/health/inventory helpers, editor, API, backend/Supabase artifacts and navigation files are byte-identical. Index remains empty. No staging, commit, push, deployment or Supabase operations.
- No browser run, full regression, build or release validation. Rendering and precise screenshot parity remain owner QA, not a claimed automated pass.

Exact localhost owner-review states at `/protocol`:

1. Desktop 1440px viewport: 960px centered container; Current Weight, Weight Change and one compact Focus above Active Protocols; no right-side list, second Focus, Recent Changes or All doses panel.
2. Your current five protocols: select TRT Injections, then HCG; selected ring lifts with colored halo, Active Compound name/week/start/dose and vial follow selection. For TRT verify existing 75 mg/dose, 2x/week, nine facts and visible vial. Check one/two/three/five/ten-plus ring compositions for centered partial rows and all protocols visible.
3. Focus with one known due dose, multiple due doses (previous/next and `1 of 3`), unknown/legacy dose (honest unknown medication plus short review), saving, failed save (error and dose retained), and all logged (completion, no Mark taken). Navigation must not write; only Mark taken logs the selected due ID.
4. Current five-protocol Schedule: week previous/next, day headers, existing logged/due/missed/off-plan markers, CSV and My Protocols; compare production spacing and typography directly. No extra disclosure/large text/44px forced table styling.
5. Health with latest/first weight and mixed observation dates; verify signed change, Energy/Sleep/Mood boxes and dates, unit switch, zero sleep, missing metrics. Empty/single-weight accounts show no fabricated change.
6. Missing-day check-in automatically prompts once; recorded-day check-in does not. Dismiss/reopen, edit/save and next-local-day behavior stay approved. No visual redesign of popup.
7. Mobile 320px and 390px, tablet 768px, dark/light themes: compact status strip, centered rings with no page overflow, cohesive facts/vial, and unchanged bottom navigation. Keyboard ring selection/focus and reduced-motion mode should retain usable selection without continuous animation.
