# UI Modernization Phase 1.1

Visual polish only, based on the delivered Phase 1 source. Today remains /protocol.

## Files changed

| File | Change |
| --- | --- |
| app/mobile-app.css | Refined shared mobile tokens and Today/tab-bar presentation |
| components/dashboard/CompoundRings.tsx | Ring dimensions now consume a CSS token, with the original 76px fallback |
| components/today/ActiveProtocolList.tsx | Moved week/status beneath name and dose; separate aligned chevron |
| components/today/TodaysFocusCard.tsx | Native progress element using the existing completed/due values |
| tests/today.test.mjs | Progress, completion, textual status and disclosure rendering assertions |
| UI-MODERNIZATION-PHASE1.1.md | This report |

## Visual changes

- Header: larger responsive wordmark, tighter welcome typography, fine separator, compact date hierarchy. Removed the decorative greeting dot visually.
- Focus: stronger green primary action, refined active-count chip, deliberate two-column dose treatment, slim real completion progress. Empty and completed states retain existing content.
- Active protocols: 84px rings on Today, larger labels, a subtle ring-area tint, selected-ring outline and existing individual colors/glow. All ring selection handlers and week calculations remain unchanged.
- Rows: larger names and icon containers, dose/frequency/route remain secondary, Active and week are tertiary and textual. Long names and details have more horizontal room because the chevron is the only trailing element.
- Cards: slightly raised navy surfaces, real two-tone subtle gradients, unified radii, softened separators and restrained shadows. Tighter section gaps and padding.
- Recent Changes: compact connecting line and event dots, clearer dated observations and text hierarchy.
- Health Trends: larger weight typography, secondary weight change, quieter metric tiles. No synthetic sparkline or fabricated trend direction was added.
- Protocol details: quieter closed disclosure with consistent radius and spacing. Expanded hero content and controls were not edited.
- Bottom navigation: compact 66px total bar before safe-area padding, 60px tab targets, clearer icon weight and active state. Translucent blurred background when supported, opaque fallback otherwise. Routes and handlers unchanged.

## Component changes and responsiveness

No components were split or replaced. Only row markup, progress markup and ring sizing were adjusted. All other visual changes use the existing class names.

390–430px layouts retain a single-column app, with 84px rings and a two-column next-dose block that allows text to wrap. The existing 640px breakpoint presents summary cards in two columns. Desktop stays centered at 760px maximum width.

Existing top/bottom safe-area support remains. The shorter tab height is reflected in the shell's clearance token so content stays above navigation.

## Accessibility

Native buttons/links and keyboard handlers remain. New progress markup has an accessible label and retains the live text count. Status is explicitly “Active”, not only a colored dot. Tab targets remain 60px tall; action buttons remain at least 44px tall. Focus outlines, light theme, reduced-motion handling and native More-dialog semantics remain.

## Validation

- 61 tests passed, no failures or skips. Includes the existing dosing, phase, timeline and disposable PGlite SQL regression tests, plus 12 Today presentation/rendering tests.
- Standalone TypeScript passed.
- Production build passed, including Next.js TypeScript validation, using temporary build-only configuration.
- Focused lint passed for ActiveProtocolList, TodaysFocusCard and today.test.mjs.
- CompoundRings has four existing no-explicit-any lint errors, confirmed at the identical lines against the Phase 1 ZIP. No new lint errors were introduced. They were retained to avoid an unrelated typing refactor.
- Actual device/browser rendering was not verified in this pass. The Phase 1 preview infrastructure limitation remains. No screenshot or iPhone visual verification is claimed.

## Scope verification

No migration needed. Schema, migrations, lib data/calculation modules, Today page controller, authentication, API routes, phase logic, Timeline page and protocol history are unchanged byte-for-byte from the Phase 1 ZIP. No dependencies or native wrapper were added. No live records were modified.

## Remaining visual gaps before Protocols redesign

- Expanded legacy hero controls and Dashboard tools still retain their earlier internal typography and density.
- Protocols/manage and its editors intentionally keep their existing design.
- Validate the finished polish on a real iPhone, including larger text, landscape safe areas, long compound names, light mode, and the More sheet.
- More extensive charting should wait for a separately scoped design/data decision; this pass shows only existing observations.
