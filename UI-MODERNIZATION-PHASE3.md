# UI Modernization Phase 3: Timeline

## Files changed

- `app/timeline/page.tsx`: retains authentication/loading/retry and filter semantics; composes presentation components and memoizes grouping/comparisons.
- `app/timeline/timeline.module.css`: route-scoped premium surfaces, typography, mobile filters, category styling, touch targets, and light/dark token support.
- `components/timeline/TimelineBaseline.tsx`: compact current weight/count/last-change summary; expandable active protocol details and existing management links.
- `components/timeline/TimelineFilters.tsx`: five scrollable, accessible filter buttons with selected state.
- `components/timeline/TimelineHistory.tsx`: month/day history, categorized event cards, expandable notes, saved-plan context, and related protocol links.
- `components/timeline/TimelineEmpty.tsx`: category-specific empty states and appropriate existing navigation destinations.
- `lib/health/timelinePresentation.ts`: presentation-only journal formatting, optional timestamp formatting, and previous-day weight comparisons.
- `tests/timeline-ui.test.mjs`: nine focused presentation tests.
- `UI-MODERNIZATION-PHASE3.md`: this report.

## Experience

Timeline remains at `/timeline`. A compact Current Baseline introduces where the user is now before the chronological history. Existing protocol details remain accessible through a native disclosure; they are not discarded. Month headers have clear separators and days retain semantic date labels. No sticky element competes with the tab bar.

All / Protocols / Weight / Journal / Labs filters preserve existing behavior, with horizontal overflow confined to the control strip. Protocol changes receive a subtle accent and a related-protocol link. Original normalized titles and descriptions remain authoritative. Mutable phase information is explicitly labeled “Saved plan context”, never presented as an immutable historical dose snapshot. No before/after values are invented.

Weight is visually prominent. Optional neutral deltas compare against the previous strictly earlier recorded calendar day, with matching units. Multiple readings on that earlier day suppress the comparison rather than invent an ordering. No medical interpretation or chart library is added.

Journal metrics become compact chips. The exact normalizer-generated metrics suffix is removed from the notes presentation to prevent duplication; the stored data and normalized event remain untouched. Longer notes expand in place. Weight remains in its existing separate weight event because normalized journal metadata does not include weight.

Labs remains an empty state with no functionality or fabricated records. Each other empty state offers an appropriate existing destination.

## Mobile and accessibility

Uses existing `--app-*` tokens, AppIcon, global safe-area shell, and bottom navigation. Content is centered at a maximum 760px width, with compact mobile padding and wrapping text/chips. Interactive controls and disclosures have 44px minimum targets, visible focus outlines, semantic buttons/links, `aria-pressed` filter state, and textual category labels. Native details/summary supports keyboard expansion. Light mode uses the established alternate tokens.

No real-iPhone or browser interaction verification was performed. Responsive behavior was reviewed in source, not claimed as device-tested.

## Data and performance

`loadTimeline.ts` and `timeline.ts` are unchanged, including normalization, duplication rules, current-phase resolution, event order, baseline derivation, and authentication. The existing loader reads all history in 500-row batches; no silent truncation or new pagination was introduced. Grouping/filtering and weight comparisons are memoized. Comparison buckets are built in one pass before sorting distinct days.

No migrations, schema changes, writes, dosing formulas, phase persistence changes, historical corrections, Labs, or AI. No Today, Protocols, navigation, API, or authentication files changed.

## Validation

- TypeScript (`npx tsc --noEmit`): passed.
- Focused ESLint on Timeline page, components, presentation helper, and tests: passed.
- Regression suite covering Timeline, Today, Protocols, dosing, save-first entry, and phase lifecycle: 76 tests, 75 passed, 1 optional SQL integration test skipped; no failures.
- Nine new tests cover prior-weight comparison, ambiguous same-day readings, mismatched units, zero journal metrics, suffix preservation, date-only timestamps, filters, saved-plan attribution, long notes, empty states, and baseline raw values.
- Production build: passed with temporary build-only Supabase/VAPID configuration. No live credentials or records used. Existing edge-runtime static-generation notice remains.
- ZIP comparison against Phase 2 verifies that only the two Timeline route files changed among existing files.

## Remaining UX gaps before Labs V1

- Real-device Safari verification of filter scrolling, long-note expansion, and screen-reader navigation.
- Very large accounts still use the existing full-history loader. Pagination/virtualization should be considered with measured production data rather than changing retrieval semantics in this visual task.
- Historical dose comparisons require immutable old/new values from existing events. Current saved plans are deliberately not substituted for missing historical evidence.
- Journal weight is shown through its separate normalized weight event, not duplicated inside journal cards.

No migration is required for this release.
