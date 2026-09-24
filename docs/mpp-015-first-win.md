# MPP-015: First win onboarding and persistent rings

Implemented on `main`, based on `a42e5d0`. Nothing staged, committed, pushed, deployed, or changed in Supabase. Existing changes to `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, and `supabase/.temp/` remain excluded.

## Product behavior

The previous signup callback introduced a five-screen carousel, Quick Start exposed several unrelated decisions together, and the active ring grid sized itself to the available compounds. Those choices delayed the first useful setup and removed the five-ring identity after the first save.

Signup now follows the existing authenticated return path, normally Today. The legacy `/onboarding` URL redirects to Today. Today performs an authenticated, explicitly owner-scoped protocol lookup without a lifecycle filter. Only a successful empty ownership result enters guided creation. Planned, Scheduled, Active, completed, paused, stopped, and other retained ownership prevent forced onboarding; failed reads do not imply eligibility.

The user begins at compound selection. Four steps cover compound, dose/route, schedule, and start/duration, followed by review. Existing users deliberately adding a protocol use the same shell. The editing form stays in its existing branch. Additional compounds use another pass through the same steps and draft; optional preparation, inventory, notes, and continuation remain disclosed.

`Not now` returns first users to Today. A per-user session-storage marker contains only `1`, with an in-memory fallback for restricted storage. Entry is marked as seen, so dismissal or browser Back does not reopen onboarding in the same session. Protocol ownership is the completion source of truth.

The first successful canonical save shows the saved values, a short ring glow, lifecycle wording, an occurrence computed with the existing schedule presentation helper when available, and `Go to Today`. Existing users get neutral saved copy without first-user animation.

| Active ring entries | Display |
| --- | --- |
| Zero | Five decorative outlines and one Add Protocol invitation |
| One to four | Named active rings with current week; remaining outlines have no labels or buttons |
| Five | All five positions populated and accessible |
| More than five | Five positions plus `+N more` leading to Manage, which retains the complete list |

The established compound IDs still select the existing protocol detail. Ordering is deterministic by protocol creation date, protocol ID, and compound ID; Today uses that same ordering so ring and detail colors agree. The visual arrangement remains three over two. Planned, future Scheduled, completed, paused, and stopped entries do not occupy active rings. There is no target count, reward for adding compounds, or plus sign in an empty ring.

## Reuse and safety

The implementation reuses `QuickStartDraft`, `Compound`, catalog/alias search, `selectCompound`, default provenance, dosing helpers, `protocolCompoundPayload`, `quickStartDates`, local-calendar/lifecycle helpers, and `saveProtocolWithEvents` calling `save_protocol_with_events_v2`. No parallel adapter, form model, date implementation, save function, dependency, or migration was added. Stored precision, calculations, event generation, and inventory quantities remain unchanged. Presentation still uses the established numeric formatting helpers.

Creation validation is shared between individual steps, review, and the existing save handler. It requires a positive finite medication dose with a medication unit, positive syringe markings with U-100/U-40 scale, or positive mL volume. Unknown measurement cannot advance until resolved. Route and schedule are explicit. Oral entries hide injection-specific recording and vial questions. Duration defaults to no recorded end date. No medical values are inferred from compound identity, except the existing safe single-unit selection. Old handoffs with missing units now retain those blanks instead of assuming mg.

Pending and successful-save refs block rapid/repeated submissions. Known server rejection keeps review and allows retry. The unchanged database RPC does not provide a creation idempotency key: after a lost response, an automatic retry cannot be proven safe. Ambiguous outcomes therefore keep the draft and block another create request; a labeled new-tab link opens Manage for inspection without discarding the draft. This is deliberately distinct from a known rollback. Exactly-once retry after an ambiguous network outcome would require a separate server-side idempotency change, outside this task's database constraints.

## Verification

- Focused tests: 84 passed across onboarding, Quick Start, creation/editing, inventory handoff, Planned protocols, and Today. After the final stylesheet cleanup, the 35 step/onboarding tests also passed again.
- Broader regressions: 247 tests; 236 passed, 7 skipped, 4 failed. Every remaining failure was reproduced against an isolated committed-HEAD snapshot. The pre-existing Today tests were updated to the current detail-slot contract and five-ring behavior.
- Remaining baseline failures: `dosing-entry.test.mjs:34` and `phase-lifecycle.test.mjs:25` omit a required date in older quick-entry fixtures; `protocol-save-dates-sql.test.mjs:10` expects an active-only rejection that the committed SQL no longer produces; `timeline-ui.test.mjs:67` expects five filters where HEAD exposes seven. No SQL or unrelated dosing/Timeline code was changed to silence these failures. SQL tests used local PGlite, never the connected Supabase project.
- TypeScript: passed. Production build: passed, all 39 static pages generated. The initial sandbox build could not fetch Inter; the normal build succeeded with network access. The final build uses the real font, not a font fixture.
- Focused ESLint comparison: no new diagnostics; 76 existing messages on HEAD versus 71 after the change. Remaining messages are in the legacy Today/Manage pages.
- `git diff --check`: passed. Index remains empty.
- `node tests/protocol-onboarding.browser.cjs`: passed using actual Today, Manage, Quick Start, ring/success components, BottomTabBar, and current styles with a local mocked transport. No backend writes. The fixture starts its own headless Chrome and closes it afterward.

Browser measurements at 320, 375, and 390 px matched the document width exactly. Visible setup controls measured at least 44 px tall. The sticky action ended at the viewport bottom. In a 390 × 430 keyboard simulation the active input ended at 342 px, above the action at 357 px. Zero through five and eight active entries retained five ring positions at all three widths. Review, syringe entry, future dates, custom/alias search, Oral/Other/injectable wording, weekends, backward navigation, rejection/retry, rapid taps, uncertain results, and normal-navigation restoration were exercised. Keyboard focus was visible on the input group; accessible names/progress and error associations were checked. Reduced motion disabled the success animation. Enlarged text remained within the viewport with vertical scrolling. Screenshots were inspected; browser runtime errors: zero.

## Remaining device checks and measurement

Real iPhone Safari and Capacitor hardware were unavailable. Check the actual software keyboard with decimal and date inputs, safe areas in both orientations, pinch/text zoom, VoiceOver reading/focus order, background/foreground return, native Back/close behavior, and the uncertain-save Manage link opening a new tab. Desktop browser viewport simulation is not evidence that those native behaviors passed.

No approved product analytics integration exists in the inspected repository. No vendor, event table, or health-bearing telemetry was added. Seen/dismissed rates, step abandonment, first-save conversion, save failures, and return visits remain unmeasured.

Recommended commit: `feat(protocols): add first-win onboarding and persistent five-ring hero`

## Changed files and explicit staging commands

These commands are for review; none were executed.

```powershell
git add -- app/auth/callback/route.ts
git add -- app/onboarding/page.tsx
git add -- app/protocol/manage/page.tsx
git add -- app/protocol/manage/protocols.css
git add -- app/protocol/page.tsx
git add -- components/dashboard/CompoundRings.tsx
git add -- components/protocols/CompoundPicker.tsx
git add -- components/protocols/EmptyProtocolRings.tsx
git add -- components/protocols/ProtocolQuickStart.tsx
git add -- components/protocols/ProtocolRingComposition.tsx
git add -- components/protocols/ProtocolSetupSuccess.tsx
git add -- components/protocols/ProtocolStartDate.tsx
git add -- components/protocols/QuickProtocolFields.tsx
git add -- components/protocols/QuickStartControls.tsx
git add -- components/today/ActiveProtocolList.tsx
git add -- docs/mpp-015-first-win.md
git add -- lib/health/protocolMutations.ts
git add -- lib/protocols/guidedSteps.ts
git add -- lib/protocols/onboarding.ts
git add -- lib/protocols/quickStart.ts
git add -- lib/protocols/rings.ts
git add -- lib/protocols/useSetupViewport.ts
git add -- tests/helpers/reactHarness.mjs
git add -- tests/inventory-protocol.test.mjs
git add -- tests/planned-protocols.test.mjs
git add -- tests/protocol-creation.test.mjs
git add -- tests/protocol-onboarding.browser.cjs
git add -- tests/protocol-onboarding.test.mjs
git add -- tests/protocol-quick-start.test.mjs
git add -- tests/today.test.mjs
```
