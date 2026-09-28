# QA-004 - UI simplification contract repairs

## Outcome and behavior

- **Business outcome:** Keep the simplified Health and Timeline UI transparent and structurally accessible without restoring fixed card heights or duplicating audit evidence; native keyboard behavior still requires browser verification.
- **Current behavior:** Ten QA assertions relied on brittle source strings or contradicted the approved consumer disclosure and responsive card contracts. Supplemental cards also omitted their recorded date and neutral no-comparison explanation, status was not consistently explicit, and desktop finding cards opted out of row stretching. Subsequent manual QA exposed a multiply mis-decoded CSS-generated Timeline chevron in every month summary.
- **Desired behavior:** Render recorded values and dates, applicable status, verification, and concise supplied-range details in the approved order; explain missing eligible comparisons neutrally; preserve full audit evidence in Analyst and Doctor Report; use natural mobile heights and equal-height closed desktop rows; render the Timeline disclosure indicator without any text glyph.
- **Acceptance criteria:**
  - [x] The ten named contracts use rendered behavior or semantic CSS assertions.
  - [x] Consumer cards show up to three recorded observations and dates, applicable status, and verification inline.
  - [x] `View details` renders as native `details`/`summary`, contains supplied-range context, and avoids duplicated readings or a full-evidence promise.
  - [x] Manual QA previously passed the requested real-browser focus, Enter/Space, accessibility, layout, zoom, and touch checks for the QA-004 scope. Browser automation remained explicitly excluded.
  - [x] A one-reading supplemental card says `No eligible prior comparison is recorded.` and makes no trend claim.
  - [x] Wider two-column finding rows stretch without a fixed height; mobile remains one column with natural height and overflow protection.
  - [x] Shared navigation, Protocol Changes rendering, Analyst evidence, and Doctor Report evidence/verification remain inspectable.
  - [x] Timeline month summaries use one CSS-drawn, assistive-technology-hidden chevron with no literal Unicode indicator or native-marker duplication.
  - [x] Manual QA previously passed for the QA-004 scope.

## Scope and preservation

- **Risk:** Medium; user-facing health presentation and shared navigation contracts, with no medical calculation or persistence change.
- **In scope:** Repair the ten QA-004 contracts, the minimum authorized Health finding/CSS behavior needed to satisfy them, and the explicitly authorized Timeline chevron correction.
- **Out of scope:** Analyst, Doctor Report, HealthNavigation, HealthDashboard, LongitudinalChanges, unrelated Timeline presentation, Supabase, dependencies, release actions, and broad refactors.
- **Allowed files:** `tests/ui-simplification.test.mjs`, `components/health/LabFindingsSummary.tsx`, `app/health/health.module.css`, `components/timeline/TimelineHistory.tsx`, `app/timeline/timeline.module.css`, and this task packet.
- **Preserved unrelated work:** `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, and `supabase/.temp/`.
- **Budget:** Unspecified. Stop if another production file is required.

## Validation requirements

| Check | Required? | Evidence |
| --- | --- | --- |
| Focused tests | Yes | `npm run validate:focused -- tests/ui-simplification.test.mjs tests/personal-baseline.test.mjs`; 2 files, 61 tests: 61 passed, 0 failed, 0 skipped, 0 cancelled, 0 incomplete; `validate:focused PASS`. |
| Broad regression | Yes | 54 files, 1,383 tests: 1,383 passed, 0 failed, 0 skipped, 0 cancelled, 0 incomplete; `validate:regression PASS`. |
| Browser tests | No | Explicitly excluded; manual QA previously passed for the QA-004 scope. |
| TypeScript | Yes | `validate:types PASS`. |
| Production build | Yes | `validate:build PASS`. |
| Manual QA | Yes | Manual QA previously passed for the QA-004 scope. |

## Assertion corrections

1. Timeline renders open and closed native month disclosures. The rendered accessible text contains only month and count, while an empty `aria-hidden` element supplies a CSS-border chevron. CSS checks retain the 52px target, summary focus coverage, hidden native markers, and distinct collapsed/expanded transforms. Automated focus and Enter/Space behavior are not claimed.
2. Canonical consumer cards are rendered to verify observations/dates, status, verification, supplied range, and the absence of a false full-evidence promise.
3. Rendered canonical and supplemental nodes verify name, history/value, status, verification, then supporting-details order. Comparison preview requires exactly three expected rows with `strong` then `time`, including exact values and dates.
4. The rendered native summary has the accessible name `View details`, contains supplied-range context, and retains a 44px target without requiring the former Evidence component.
5. Rendered comparison details are checked against the inline observations to prevent duplicated values or dates.
6. Semantic CSS checks cover the 640px one-to-two-column transition, desktop row stretching, natural mobile sizing, overflow protection, and the 44px disclosure target without an exact fixed card height.
7. Rendered shared navigation verifies Analyst and Doctor Report destinations/active states; live component harnesses expose Analyst evidence plus Doctor Report current, previous, change, baseline, source evidence, and verification contents.
8. Starting from Analyst, the rendered shared Protocol Changes control performs a URL transition to `/health?view=changes`; the dashboard then renders the real `LongitudinalChanges` with only navigation and fetch boundaries mocked.
9. A rendered one-reading supplemental card shows its value/date, applicable range, and the deterministic neutral no-comparison explanation; trend language appears only on an eligible comparison card.
10. The real details/summary structure, closed markup, accessible name, accent/focus styling, and 44px target are verified semantically. Native focus, Space/Enter toggling, and expanded/collapsed accessibility state remain unverified pending an authorized browser test.

## Authorization boundaries and stop conditions

- Staging, commit, push, deployment, and Supabase changes are not authorized.
- Stop if completion requires any production file outside the allowed list or any excluded validation/action.
- All required focused, type, full-regression, and build validation passed. QA-004 is ready for staging and commit; neither action is authorized or performed by this documentation closeout.

## Timeline chevron correction

- **Root cause:** `.monthSummary span::after` generated a right-chevron from a source string that had already been decoded incorrectly more than once, leaving visible mojibake. Timeline JSX and presentation helpers did not supply the glyph.
- **Correction:** `TimelineHistory` renders an empty `aria-hidden` span. `.monthChevron` draws the indicator with right and bottom borders, points right while collapsed, and rotates down under `.monthGroup[open]`. The native marker remains suppressed.
- **Encoding safety:** The visual indicator contains no character data, Unicode escape, icon font, or dependency.

## Human-first status correction

- **Final regression blocker:** The consumer-facing label was corrected from `Reported status` to `Lab status` while preserving the status value and verification messaging.
- **Contract preservation:** `tests/personal-baseline.test.mjs` was not modified to bypass the contract. The final focused and full-regression runs passed without failures, skips, cancellations, or incomplete tests.

## Remaining qualification

Browser automation remained outside the QA-004 validation scope. Manual QA previously passed for the QA-004 scope. With focused, type, full-regression, and build validation passing, QA-004 is ready for staging and commit.
