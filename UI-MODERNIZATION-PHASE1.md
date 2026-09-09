# MyPepProtocol UI modernization: Phase 1

## What changed

Today remains at `/protocol`. It now has a compact branded date header, Today's Focus, active protocol rings and list, Recent Changes, and Health Trends. No user-specific values from the reference mockup were copied.

The Olympic-style rings remain clickable. They are now native keyboard-operable buttons with full-name accessible labels. Selecting a ring or protocol row opens the original HeroProtocolCard, including its existing schedule, inventory, phase controls, and sharing. The hero component itself was not modified.

Existing daily logging, weekly schedule, charts, export, and event editing remain under Dashboard tools. Calculator-prefilled creation remains available. The empty-account loader no longer creates demo protocols or fabricated journal entries. Existing demo records are not deleted.

## Exact file list

Modified:

- `app/protocol/page.tsx`: mounts the modular Today view; preserves existing actions in expandable tools; removes automatic demo seeding; refreshes presentation after existing hero actions; checks injection-write errors before showing success.
- `app/layout.tsx`: mounts AppShell and imports mobile tokens/styles; declares the Next.js viewport export with viewport-fit=cover. Existing theme initialization and service-worker registration remain.
- `components/BottomNav.tsx`: delegates to the reusable BottomTabBar.
- `components/ThemeToggle.tsx`: supports placement in More; adds a descriptive accessible label and 44px target.
- `components/dashboard/CompoundRings.tsx`: keeps ring selection, adds native buttons/full-name labels, increases small text readability and tones down glow.

Added:

- `app/mobile-app.css`: dark/light design tokens and scoped Today/mobile-shell styling. Existing globals.css tokens and unrelated page layouts are unchanged.
- `components/app/AppShell.tsx`: shared safe-area content clearance and navigation; leaves public/auth pages outside the tab shell.
- `components/app/AppIcon.tsx`: consistent lightweight SVG interface icons, no new library.
- `components/app/BottomTabBar.tsx`: five tabs and an accessible native-dialog More sheet.
- `components/today/TodayOverview.tsx`: composes the new sections.
- `components/today/TodayHeader.tsx`: branding, date, profile link.
- `components/today/TodaysFocusCard.tsx`: next unlogged dose for today, completion count, empty states, save feedback.
- `components/today/ActiveProtocolList.tsx`: current real compound data, preserved rings, detail selection.
- `components/today/RecentChangesCard.tsx`: recent normalized protocol events.
- `components/today/HealthTrendsCard.tsx`: dated journal observations and existing weight conversion.
- `lib/health/today.ts`: read-only presentation adapters using existing phase/dosing/timeline normalization.
- `lib/tabs.ts`: deterministic active-tab mapping.
- `tests/today.test.mjs`: 11 presentation, navigation, rendering, and save-path contract tests.
- `UI-MODERNIZATION-PHASE1.md`: this report.

## Navigation

| Tab | Existing destination |
| --- | --- |
| Today | /protocol |
| Protocols | /protocol/manage |
| Timeline | /timeline |
| Health | /journal |
| More | Sheet linking Profile, Calculator, Tracker, Learn, and existing conditional Admin access |

Appearance is in More. No new application routes or authentication changes.

## Data and behavior

- Active protocols: existing active `protocols`, nested `compounds` and `phases`.
- Dose display: existing `currentPhase()`, `dosingDisplay()`, and `resolveBaselineDetails()`. No new conversions or phase inference.
- Today's Focus: existing schedule eligibility and injection logs; saved time-of-day labels only, no invented clock times. “Next” means the earliest unlogged item in today's saved time groups, not a new scheduling engine.
- Mark taken: existing `injection_logs` upsert and `user_id,compound_id,date` conflict key. Failed writes leave completion state unchanged and show retry guidance.
- Recent Changes: existing `protocol_events`, enriched from already-loaded protocol relationships through the existing timeline normalizer.
- Health Trends: existing `journal_entries` and profile weight-unit preference. Weight difference is latest minus earliest available weight, with the prior date shown. Each energy/sleep/mood observation shows its own date. Missing readings are not filled in.
- The existing app's UTC log-date convention remains unchanged.

## Mobile and accessibility

Near-black/navy surfaces, soft purple identity accents, green focus treatment, thin borders and rounded cards. Content is centered at a 760px maximum. Phone cards stack; summary cards become two columns at 640px. Long compound names and metadata wrap. Fixed tabs include bottom safe-area padding; shell content includes top safe-area padding and bottom navigation clearance.

New controls have at least 44px targets, visible keyboard focus, accessible labels, and no hover-only actions. More uses a native modal dialog with Escape dismissal and focus handling. Loading/status/errors are announced. Reduced-motion preferences disable the ring transition. Light-mode tokens are included.

## Validation

- TypeScript: `npx tsc --noEmit` passed.
- Focused ESLint for the new components, helpers and test file: passed. This is not a claim that the repository-wide legacy lint backlog is clean.
- Test suite: 60 tests passed, including 11 new Today tests and existing dosing, timeline, phase lifecycle, and SQL migration regression tests. SQL tests used a disposable local PGlite database, not production.
- Production build: `npm run build` passed, with temporary non-production Supabase/VAPID build configuration. No credentials were added to the ZIP.
- Browser limitation: the available visual preview runner supplies Vite flags that this Next.js server does not accept. No framework/build-script changes were made to accommodate that environment. Responsive CSS and server-rendered component output were checked, but authenticated browser interaction, actual iPhone/tablet/desktop rendering, and device safe areas still need a live smoke test. No screenshots are claimed.

Suggested deployment smoke test: open Today at 390px and 430px, select each ring, open/close protocol details, log and undo a dose, use More/appearance, and visit each tab. Also check 768px and desktop widths and an account with no protocols.

## Scope

No new migration is required. No schema, API-route, dosing-conversion, phase-rule, authentication, or Timeline-page changes. No Labs, AI, live data correction, native wrapper, new UI framework, or new dependencies.
