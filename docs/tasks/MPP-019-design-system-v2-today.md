# MPP-019 — Design System V2 and Today

## Task and authorization

Implement the owner-approved Today presentation architecture. Risk: medium (shared UI), with no business-logic change. Implementation handoff only; stop for Rafael's visual review. Independent review and release validation remain later gates. No staging, commit, push, deployment, Supabase, package, helper, API, schema, or migration changes are authorized. Budget unspecified.

## Acceptance contract

- Compact wordmark/profile header, neutral greeting and local date; Focus is the first functional card and Mark taken the sole dominant action while pending.
- Preserve dose ordering, previous/next browsing, completion, failed saves, refresh, date reset, check-in persistence, onboarding, planned activation, scheduled dates, missed-dose conditions, lifecycle, inventory and CSV behavior.
- Every active compound has a ring and compact row sharing selected state and identity color. Preserve groups of three and centered final partial rows. Rows select; separate links open existing management destinations. No capped count, carousel or pagination.
- Reuse canonical phase/frequency/medication presentation; unknown medication stays explicitly unknown. One review issue at most per row. No parsing combined dose strings or new health/dosing/schedule calculations.
- Mounted native disclosures contain all doses, check-in, selected protocol tools, and weekly schedule/logs. Keep the current MPP-017/018 HeroProtocolCard presentation unchanged.
- Recent changes use at most three existing normalized events. Health trends show dated recorded weight, signed existing difference, Energy/Sleep/Mood; missing values say “Not logged.” No new scores, interpretations, projections or causal claims.
- Today-only dark/light V2 tokens, minimal used primitives, restrained surfaces, consistent typography and spacing. Mobile 16px gutters, desktop ~1120px/24px gutters with 2:1 content, no page overflow, safe bottom navigation, 44px targets, visible keyboard focus and reduced motion.
- Preserve other product pages and all existing local work. No motivational quote, leading stats, repeated default dose block or decorative backdrop.

## Scope and baseline

Baseline: local `main` at `0986510`, verified before edits (production not inspected). The allowed surfaces are the owner's enumerated Today/app-shell/ring files, two scoped CSS modules, minimal DesignSystem/ProtocolRing/ProtocolRow components, focused tests and this packet. Global styles, BottomTabBar, helpers and other pages are excluded.

Pre-existing modified files (all preserved): `app/api/create-protocol/route.ts`, `app/calculator/CalculatorClient.tsx`, `app/protocol/manage/page.tsx`, `app/protocol/manage/protocols.css`, `components/app/BottomTabBar.tsx`, `components/dashboard/HeroProtocolCard.tsx`, `components/protocols/{PhaseCard,ProtocolCard,ProtocolDetail,QuickProtocolFields}.tsx`, `docs/mac-handoff-checklist.md`, `lib/health/{dosingEntry,protocolPresentation}.ts`, `lib/protocols/{form,quickStart}.ts`, `tests/{dosing-entry,protocol-creation,protocol-numeric-display,protocol-quick-start,protocols,structured-events}.test.mjs`, `tests/timeline.test.ts`.

Pre-existing untracked: `components/protocols/DoseSummary.tsx`, MPP-017/018 task packets, `supabase/.temp/`, `tests/calculator-capacity.test.mjs`, `tests/create-protocol-api.test.mjs`. SHA-256 preservation hashes for all 39 pre-existing dirty/untracked files were recorded outside the repository before editing. DoseSummary is consumed without modification.

## Validation and stop conditions

Required: `validate:focused` for Today, dose order, onboarding, new Today V2, numeric display, health command center, pre-capacitor hardening, iPhone QA, and app-store readiness; `validate:types`; `git diff --check`. A browser fixture may cover layout/selection/focus without real backend writes. Full regression, production build and `validate:release` explicitly excluded. Stop if implementation requires changing a protected business/helper/backend boundary; otherwise finish the authorized presentation work and hand off for visual review.

Baseline focused run before implementation: **164 tests, 163 passed, 1 failed, 0 skipped/cancelled/todo**. Existing failure: `protocol-onboarding.test.mjs`, “each step validates its shared draft section without a later missing answer masking an error,” line 57: expected `dose`, actual `route`. Do not alter this unrelated protection to conceal the baseline failure.

## Implementation outcome

Implemented the approved DOM order: header/greeting/local date → Focus (all-doses and check-in disclosures) → Active protocols (all rings + all rows + selected tools) → Schedule/logs → Recent changes → Health trends → existing planned/scheduled sections and conditional notices → unchanged bottom navigation. Empty accounts do not get an empty schedule disclosure. Removed leading StatsBoxes and the closing motivational line from Today only.

V2 lives in scoped CSS Modules and applies through AppShell only at `/protocol`. Added only used primitives: SectionHeader, SectionCard, StatusPill, PrimaryAction, SecondaryAction, CompactDisclosure and SummaryGrid; extracted ProtocolRing and added ProtocolRow. Dark/light palette, 4–32px spacing, 8/12/20/24px radii, type scale, tabular metrics and restrained surfaces follow the approved contract. The opaque Today shell covers the old ambient background without changing global CSS. The existing Inter setup is unchanged.

Rings retain the original placement algorithm and identity palette, with calmer glow and a non-color selected outline. Rows use the same ordered ring items/colors and existing selected state; native selection buttons and separate management links stay distinct. Removed/stale selection falls back consistently to the first visible compound. Row medication uses the untouched DoseSummary helper when known, explicit unknown text otherwise; phase/frequency and one review issue come from existing helpers. Nothing parses combined dose strings or infers medication from markings.

Focus retains its original pending-dose selection and navigation logic, callbacks, completion count, errors and date key. Mark taken is the only prominent action when pending. All doses is a read-only ordered list. Native disclosures keep children mounted, including HeroProtocolCard and WeeklySchedule. HeroProtocolCard and DoseSummary remain byte-for-byte unchanged from the dirty baseline. The check-in gains an accessible notes label and a secondary save button with identical callbacks.

Recent changes renders at most three supplied normalized events. Health trends uses unchanged journalSnapshot/weight helpers and real observation dates, including zero sleep, signed weight differences and “Not logged” for missing values. There are no new health calculations or interpretations.

Mobile uses 16px gutters, 80–104px rings, ordinary rows around 80px that expand for long names, and a full-width primary button. Desktop centers content at 1120px with 24px gutters; Focus uses its spare width for disclosures and the following content uses a 2:1 grid. Rings sit beside rows when their container is wide enough. Existing safe-area shell/nav spacing is retained. New controls use 44px minimum targets, visible focus and 140ms transitions disabled under reduced motion; schedule targets and legacy editable input size are adapted only inside Today.

## Changed files (MPP-019 only)

- `app/protocol/page.tsx` — presentation wiring, scoped container, CSV control and conditional notice copy/styles.
- `app/protocol/today-v2.module.css` (new) — Today layout, ring/row styling, responsive rules and scoped legacy adapters.
- `components/app/AppShell.tsx` — exact-route V2 theme.
- `components/app/DesignSystem.tsx`, `components/app/design-system-v2.module.css` (new) — used primitives, tokens and accessibility styles.
- `components/dashboard/CompoundRings.tsx` — consistent presentation fallback for stale selection.
- `components/dashboard/WeeklySchedule.tsx` — one CSS hook; scheduling/handlers unchanged.
- `components/protocols/ProtocolRingComposition.tsx` — render extracted ring with unchanged grouping/placement.
- `components/protocols/ProtocolRing.tsx`, `components/protocols/ProtocolRow.tsx` (new) — ring and row presentation.
- `components/today/TodayOverview.tsx`, `TodayHeader.tsx`, `TodaysFocusCard.tsx`, `ActiveProtocolList.tsx`, `RecentChangesCard.tsx`, `HealthTrendsCard.tsx`, `DailyCheckIn.tsx` — approved hierarchy, compact content and disclosures.
- `tests/today.test.mjs`, `tests/today-dose-order.test.mjs` — approved presentation expectations and component/CSS-module loading; retained behavioral assertions.
- `tests/today-v2.test.mjs`, `tests/today-v2.browser.cjs` (new) — selection/identity, known/unknown medication, warnings, callbacks, real health values, contrast and browser scenarios.
- This task packet.

## Validation evidence — October 4, 2026

| Check | Result |
| --- | --- |
| Required focused suite, 9 files | 174 tests: **173 passed, 1 baseline failure**, 0 skipped/cancelled/todo. The failure is the same onboarding `route` versus `dose` assertion recorded before implementation. No new failures. |
| Final affected Today recheck, 3 files | **31/31 passed**, after the final component changes. Other successful checks were reused where unaffected. |
| `validate:types` | **Passed** after final component changes. |
| CSS Modules compilation | Both modules passed Next's installed PostCSS local-by-default pure mode and scope processors. This is not a production build. |
| `validate:browser -- tests/today-v2.browser.cjs` | **88 checks passed**, 0 runtime errors; owned process-tree cleanup passed. |
| `git diff --check` | **Passed**; staging remains empty. |
| Preservation | All 39 pre-existing dirty/untracked files retain their initial SHA-256 values, including BottomTabBar, HeroProtocolCard, DoseSummary, MPP-017/018 work and Supabase temp files. |
| Full regression / production build / release validation | Not run, explicitly excluded from this implementation gate. |

The initial browser attempt hit a sandbox/Chrome connection timeout and denied PID-scoped cleanup. The owned supervisor was subsequently cleaned up with escalation; the final run uses the normal browser supervisor outside that restriction. Fixture import-path and keyboard-event issues were corrected before passing checks. No timeout is counted as a pass.

Browser coverage uses actual Today page/components/AppShell/BottomTabBar, with mocked Supabase and Next navigation, and disabled PWA registration. It checks five viewport widths (320, 390, 768, 1024, 1440), all rings/rows, centered partial rows, ring sizes, no page overflow, primary action reach, ring/row selection, separate management navigation, keyboard disclosure/focus, mounted check-in draft/callbacks, schedule touch targets, CSV availability, failed-save recovery, completion, empty states, 1–15 protocols, light theme, reduced motion, bottom navigation clearance, load errors/retry and zero runtime errors. All writes stay in fixture memory. Report: `%TEMP%/mpp019-browser.json`; screenshots are in the report's temporary fixture directory. Dark/light, desktop, mobile and expanded-tools screenshots were visually inspected.

## Remaining review and exact local targets

Stop here for Rafael's visual review. This is not release approval. The fixture transforms CSS modules locally and does not test Next production packaging, live authentication/backend delivery, the actual loaded Inter font, or physical iOS safe-area behavior. Existing Hero tools intentionally keep their MPP-017/018 internal presentation. Native-device visual QA and independent review remain pending, as does the unrelated onboarding baseline failure.

With the local development server on port 3000:

1. `http://localhost:3000/protocol` at ~390px and desktop 1440px, dark and light: pending Focus, previous/next, completed and no-dose states; all-doses/check-in disclosures; 1/2/3/4/5/10+ active compounds; long names and unknown/review-needed doses; selected tools, weekly schedule, empty/partial health and three recent events. Check planned/scheduled sections and conditional notices when the account has those states. Use local mocked/test data for write scenarios.
2. `http://localhost:3000/protocol/manage` and `http://localhost:3000/protocol/manage?new=1`: existing Manage/Add destinations; row chevrons retain `/protocol/manage?protocol=<existing-id>`.
3. `http://localhost:3000/profile`, `http://localhost:3000/protocol/inventory`, `http://localhost:3000/timeline`, `http://localhost:3000/timeline?category=journal`, and `http://localhost:3000/journal`: preserved profile, inventory and secondary-card destinations.

No staging, commit, push, deployment, backend, schema, migration or Supabase modification was performed.
