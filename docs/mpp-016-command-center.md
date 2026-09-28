# MPP-016: Executive Health Command Center

Health (`/health`) now opens with the Command Center. Today retains its focus,
scheduled actions, check-in, protocol navigation, persistent rings, onboarding,
and CSV export. Its complete Charts & weekly recap block, recap controls/cards,
combined signal chart, event dots/labels, and weight chart were removed. The old
WeeklySummary source remains unused; unrelated maintenance scripts reference it.

## Architecture and navigation

- `HealthDashboard` owns the selected range and preserves it across Health
  subview interactions. Labs moves to `/health?view=labs`; existing panel,
  biomarker, import, Analyst, protocol changes, and report destinations remain.
- `loadCommandCenter` follows the existing client-side Health loading boundary.
  It authenticates with the existing Supabase client and reads the owner's saved
  weight unit. Profile query errors do not silently guess a unit.
- `readTimelineEntries` extracts the existing owner-scoped, paginated Timeline
  journal/event reads. It retrieves complete history in pages of 500 rather than
  truncating All to the database's default row limit. Timeline uses the same
  reader; its normalization and remaining protocol/lab reads are unchanged.
- `commandCenterModel` is the single typed, pure range/calculation boundary.
  The existing longitudinal measurement selector is lab-only, so it is not
  repurposed to interpret journal signals.
- No new endpoint, chart dependency, persistence, migration, telemetry, AI
  generation, protocol semantics, authentication change, or Supabase modification.

## Calculations and calendar rules

- 7D is the default; 7D/30D/90D include today and the preceding N-1 local dates.
  All includes recorded history through today, without an invented denominator.
  The existing local-date hook updates at midnight and on focus. Date-only values
  are validated as calendar dates, never parsed as UTC. Actual timestamps are
  converted to local dates; malformed and future observations are excluded.
- Logging counts distinct dates with a valid weight, score, sleep observation,
  or nonblank journal note. Blank rows and protocol changes do not count.
- Weight is the latest minus earliest valid recorded day inside the range,
  converted from canonical stored pounds into the saved pounds/kg preference.
  Missing, nonfinite and nonpositive values are excluded. Fewer than two recorded
  days gives Not enough data. Equal same-day weights are deduplicated; conflicting
  same-day weights are omitted with an explanation, without inventing ordering.
- Sleep averages valid recorded 0–24-hour observations, including explicit zero.
  Mood and Energy average valid integer scores 1–5. Missing values never become
  zero. Means and weight changes use one decimal; weight change is signed and
  has no good/bad semantics. Repeated source IDs cannot inflate the means.
- The summary describes recorded days, average sleep, and weight change. It makes
  no diagnostic, recommendation, or protocol/outcome causal claim.

## Charts, context, and states

Existing Recharts draws a dedicated purple weight line with a padded vertical
domain that does not force zero. Its horizontal domain begins at the first valid
recorded weight and ends at the last, preserving chronological spacing with at
most three date ticks and no invented measurements. One weight is centered as a
marker without a trend line; two weights occupy the plotted date boundaries.
Mood, Energy, Sleep are separate compact rows: scores use 1–5; sleep has its own
hours scale. Gaps break signal lines. Weight lines connect recorded observations
with explicit explanatory text; no unrecorded value is exposed as an observation.
One point is explicitly described as insufficient for a trend.

Charts expose named date/value tooltips to pointer and keyboard users, plus a
native date/value selector and textual output for touch and assistive technology.
Range changes interpolate paths over 320 ms and use a single summary highlight.
Initial load does not animate values. Reduced motion removes chart, summary, and
range-control animation. The range change itself causes no navigation or reload.

Command Briefing appears after the charts and contains at most one ranked measured
change, one data-confidence item, and one aggregated protocol-activity item. The
activity item summarizes protocol changes across dates, identifies the busiest
recorded date when relevant, and links to the Protocols-filtered Timeline. It does
not render a latest-events feed, place event labels over charts, or introduce
causal wording.

Loading uses static placeholders without fake values. Empty and partial sources
have section-local messages, retaining available charts and Health navigation.
Failures show one generic message and retry; provider details are not exposed.
The existing shell owns safe areas and the single bottom navigation.

## Validation

- Dashboard calculation/contract tests after the visual correction: 36 passed.
- Original combined Today, Health/labs/Analyst, longitudinal, Timeline, identity,
  onboarding, and email OTP suites: 437 tests, 434 passed, 3 failures below.
- Correction Health/labs/Analyst, longitudinal, Timeline, identity, and dashboard
  run: 360 tests, 357 passed, the same 3 previously reproduced HEAD failures.
- Actual-component local Chrome fixture after correction: 225 checks passed; every range at 320, 375, 390, and 1024
  px; desktop content constrained to 760 px; no horizontal overflow; interactive
  controls at least 44 px. Full, partial, no weight, one weight, no journal,
  no events, empty, loading, and retry states checked. Real chart path interpolation,
  keyboard/pointer inspection, accessibility names, range persistence, and reduced
  motion checked. Dashboard HTML text enlarged to 200% at 390 px without horizontal
  overflow or obstructing navigation. Metric values, units, labels, and secondary text exceed 4.5:1.
  Supabase is mocked with synthetic data. The unrelated lazy PDF engine is stubbed;
  PDF extraction itself is outside this fixture's coverage.
- Existing Today/onboarding Chrome fixture passed: first protocol creation,
  planned/scheduled flows, saved results, persistent rings, keyboard/focus,
  reduced motion, and mobile widths. No runtime errors in either fixture.
- `npx tsc --noEmit`: passed. `npm run build`: passed.
- Focused lint: all changed Health TypeScript files clean. Today has 22 errors
  and 17 warnings, down from committed HEAD's 39 errors and 20 warnings, with
  no new findings. Existing Today lint failures were reproduced on the HEAD
  snapshot; they were not expanded into a broad cleanup.
- `git diff --check`: passed.

Three broader failures reproduced against a fresh `git archive` of committed
`76e4f13835349132ef2270d933a29d2286bc600e`, using the same installed dependencies:

| Test | Failure on working tree and committed HEAD |
| --- | --- |
| `longitudinal.test.mjs:378` — pagination resets through the URL-keyed list, while the selector and periods stay mounted | Expected 2 `window.history.pushState` occurrences; found 3. |
| `timeline-ui.test.mjs:67` — all five accessible filter controls remain with one selected | Expected 5 buttons; found 7. |
| `timeline.test.ts:115` — baseline omits expired, overlapping, undated, and future dosing context | Line 119 reads `week` from undefined. |

HEAD reproduction: `node --test tests/longitudinal.test.mjs tests/timeline-ui.test.mjs tests/timeline.test.ts`
returned 107 tests, 104 passed, the same 3 failures. The changed longitudinal
assertion at line 258 only recognizes that Overview also skips Labs loading;
it is separate from the existing failure at line 378.

Local evidence is in the system temporary directory: `mpp016-tests.txt`,
`mpp016-build.txt`, `mpp016-lint-head.json`, `mpp016-lint-after.json`, and
`mpp016-browser.json`. The archived HEAD test log is under
`mpp016-head-69c8a76635bd495881aded21d73f8e00/head-tests.txt`.

## Focus and sparse-signal correction

The installed Recharts accessibility layer renders the root SVG as
`tabindex="0" role="application"`. Its wrapper is not focusable. The initial
Command Center CSS applied a 2 px outline directly to `.recharts-surface:focus-visible`,
which frames the rectangular SVG plotting surface. The correction suppresses
only that SVG's focused outline and uses a rounded, accent-colored chart-frame
shadow when its SVG matches `:focus-visible`. Native inspection controls retain
their own focus outlines. Accessible names, arrow-key values, and a linked chart
description remain. Chrome checks cover mouse, emulated touch, Tab, Shift+Tab,
Enter/Space activation of native inspection, and Left/Right arrow inspection.
Mouse/touch checks confirm no SVG outline or keyboard frame; keyboard checks
confirm the visible rounded frame. This does not claim inspection of the user's
production browser; the DOM and input tests use the actual local components.

`commandCenter.ts` owns the typed `none | single | sparse | trend` policy:

- 7D: at least 5 distinct valid recorded days, including a run of at least 3
  consecutive recorded days.
- 30D: at least 12 distinct valid recorded days, including a run of at least 4
  consecutive recorded days.
- 90D: at least 30 distinct valid recorded days across at least 6 Monday-based
  local weeks, including a run of at least 3 consecutive recorded days.
- All: daily observations are grouped into Monday-based local calendar weeks.
  A week qualifies only with valid observations on at least two distinct days,
  and its plotted value is the average of every valid recorded observation in
  that week. A trend requires at least four qualifying weeks, at least 50%
  qualifying-week coverage from the signal's first recorded week through the
  current local week, and a run of four consecutive qualifying weeks.
- Counts/averages still use valid recorded entries; duplicate dates cannot
  inflate coverage. One observation is `single`; multiple observations on one
  date remain `sparse`. This is a display policy, not a clinical threshold.

Each signal is evaluated separately. None shows No recorded data. Single shows
the recorded value, date, and one entry. Sparse shows its average, exact entry
count, coverage, and value inspector without a plot. Short-range trends retain
missing-day gaps. All-range trends retain missing or non-qualifying week gaps,
show no permanent point markers, and expose each exact weekly average, Monday-to-
Sunday date range, and observation count through chart and native inspection.
When no All-range signal qualifies, one compact panel is headed Not enough
consistent weekly data for trends. Each signal row keeps its recorded average,
entry count, qualifying-week coverage, consistency guidance, and its own native
inspection action; there is no single Review logged values action. Mixed states
keep qualifying charts while non-qualifying signals remain compact. Check-in days
mean distinct dates with valid Mood, Energy, or Sleep values.

Sleep/Mood KPI copy and the summary explicitly scope averages to recorded entries.
Weight does not use the daily-signal coverage policy. Existing weight calculations,
Timeline loading/identity, and Today were not modified by this correction.

A signal presentation change animates the panel's measured height once over
320 ms, where the browser supports element animation. Newly qualifying charts
appear without point animation; existing qualifying charts retain 320 ms path
interpolation. Reduced motion cancels/skips layout and chart animation. No missing
values are animated or zero-filled.

New regression coverage includes 9/90 sparse data, all four signal states, mixed
states, exact counts/means, duplicate-day boundaries, All-range trailing gaps,
intermittent weight independence, mobile layouts, and sparse/trend transitions.
The existing source-order assertion now references the extracted DailySignals
component. Browser assertions for partial data and keyboard focus were updated
to require the newly requested behavior, rather than the old sparse-dot charts
or SVG rectangle. `tests/longitudinal.test.mjs` was not changed further.

Correction evidence: `mpp016-correction-unit.txt`, `mpp016-correction-tests.txt`,
`mpp016-correction-lint.json`, `mpp016-correction-build.txt`, and
`mpp016-browser.json` in the system temporary directory. Focused correction lint
has zero errors/warnings, matching the previously clean Health files.

## Real-data visual correction

- Add / Import is a fixed-position, compact action menu anchored to its trigger.
  It preserves the manual, CSV, and PDF destinations and supporting copy, fits
  within the viewport, does not alter document layout, closes on selection,
  Escape, pointer-outside interaction, or keyboard focus leaving the trigger/menu
  group. Native Tab and Shift+Tab order is preserved; Escape and pointer dismissal
  restore trigger focus.
  The shared navigation keeps the same menu on Overview, Labs, Protocol changes,
  AI Analyst, and Create report.
- All-range Mood, Energy, and Sleep charts use the weekly policy above rather
  than disconnected daily fragments. Failing any weekly qualification retains
  the compact summary, qualifying-week coverage, and raw recorded-value inspector.
- Weight uses a linear, unsmoothed line over its recorded-date domain. Supporting
  context reports the actual weigh-in count and first-to-last recorded dates;
  conflicting same-day weights continue to be omitted.

## Remaining device checks and handoff

Check real iPhone Safari and the iOS app shell with actual user data: native
date/value selection, VoiceOver announcements and focus, Dynamic Type/browser
text enlargement, notch/home-indicator insets, orientation, and range motion with
Reduce Motion on/off. Browser emulation and synthetic transport do not establish
real-device or production-data behavior.

Suggested commit: `feat: add executive Health command center (MPP-016)`.

Complete MPP-016 intended-file manifest (commands provided for review; not executed):

```powershell
git add -- app/protocol/page.tsx
git add -- components/health/DoctorReport.tsx
git add -- components/health/HealthDashboard.tsx
git add -- components/health/HealthCommandCenter.tsx
git add -- components/health/HealthDailySignals.tsx
git add -- components/health/HealthNavigation.tsx
git add -- components/health/HealthTrendChart.tsx
git add -- components/health/command-center.module.css
git add -- components/health/health-navigation.module.css
git add -- lib/health/commandCenter.ts
git add -- lib/health/loadCommandCenter.ts
git add -- lib/health/loadTimeline.ts
git add -- tests/doctor-report.test.mjs
git add -- tests/health-command-center.test.mjs
git add -- tests/health-command-center.browser.cjs
git add -- tests/longitudinal.test.mjs
git add -- docs/mpp-016-command-center.md
```

Exclude the pre-existing changes in `components/app/BottomTabBar.tsx`,
`docs/mac-handoff-checklist.md`, and `supabase/.temp/`. Nothing was staged,
committed, pushed, deployed, or changed remotely.
