# Today — non-blocking daily check-in panel

Owner request: replace the invasive daily check-in popup with a panel that rises from the bottom while the page remains usable. Scoped, low-risk UI interaction/presentation change; no journal/data behavior change. Independent review optional for this narrow UI gate, not requested. No separate reviewer used.

Acceptance: bottom slide-in, no backdrop/inert page/scroll lock/focus trap; automatic opening leaves existing focus alone; manual opening focuses the panel heading; close/Skip/Done and Escape inside the panel dismiss it; page interactions keep it open and draft values remain owned by the page. Navigation stays visible and clickable, panel height is capped with its own scroll area, reduced-motion preference removes animation, and last page content can scroll above it. Once-per-account/local-day timing, recorded-day suppression, supplied inputs/save handlers and persistence stay unchanged.

Owner saw the bottom panel appear and requested a slightly slower transition during implementation: increased slide-up from 240ms to 420ms, keeping the same easing and reduced-motion handling.

Follow-up request first increased the entrance to 600ms; the owner's latest request for 4–5 times slower now sets it to 3 seconds (5× 600ms). Duration-only CSS adjustment; easing, reduced-motion handling and panel behavior unchanged. Diff check passed; focused tests/types were not repeated for these timing-only edits.

Scope: `DailyCheckInPrompt.tsx`, Today-scoped panel CSS, affected focused tests and future browser fixture expectations, this packet. Preserve all existing dirty/untracked work; 68 pre-existing file hashes recorded before editing. No page/calculation/helper/API/backend/Supabase/editor/navigation edits or staging/commit/push/deploy authorization.

Retain the Today task's agreed narrow validation gate: relevant focused tests, TypeScript and `git diff --check`. No full regression, production build, release or browser execution. Manual visual/keyboard QA remains an owner review step; this gate is not a release gate.

Implemented a fixed, non-modal panel above bottom navigation, capped at 60dvh/520px with a scrolling body and always-visible close header. No full-page backdrop, native modal, page scroll lock, outside-click dismissal or automatic focus capture. Explicit entry focuses the heading; Escape inside, close, Skip and Done dismiss it, restoring trigger focus only if focus was inside. Page interactions leave the panel open. Additional bottom spacing while open lets the last content scroll above it. Existing prompt-day map/effect, child inputs and save handlers remain unchanged.

Changed files: `components/today/DailyCheckInPrompt.tsx`, panel-only rules in `app/protocol/today-v2.module.css`, `tests/today-checkin-prompt.test.mjs`, future expectations in `tests/today-v2.browser.cjs` (not executed), and this new packet.

Validation:

- `npm run validate:focused -- tests/today-checkin-prompt.test.mjs tests/today-v2.test.mjs`: **24 passed, 0 failed, 0 skipped**. Covers once-per-owner/local-day timing, recorded suppression, non-modal/automatic focus behavior, explicit opening/closing/Escape/Tab handling, outside focus preservation, drafts and supplied save callbacks, plus existing Today presentation behavior.
- `npm run validate:types`: **PASS**.
- `git diff --check`: **PASS** (exit 0).
- Preservation: **64/68** pre-existing dirty/untracked files byte-identical; only the four intended existing files above changed, plus this packet. Prompt timing effect is identical to intake. CSS outside the check-in panel section is identical to intake. DailyCheckIn inputs, Today page/wiring, all other components/helpers/API/backend/Supabase/editor/navigation work preserved. Nothing staged, committed, pushed or deployed.
- No browser/build/full regression run. Owner confirmed seeing the bottom slide-up; full responsive/keyboard/manual QA remains pending. Review the slower entrance, scrolling/clicking the page and navigation while open, automatic versus manual focus, close/reopen with draft values, short/mobile viewport form scrolling and reduced-motion mode.

Latest owner correction: the check-in must fit without a vertical panel scrollbar. This supersedes the capped-height/scrolling-body acceptance above. Use compact score rows, paired sleep/weight fields, a two-line notes field and side-by-side Save/Skip controls; remove the scrolling body and its height cap rather than clipping the form. All scores, deltas/errors, inputs, notes, save and dismissal remain visible. Keep native callbacks, non-modal focus/page behavior, safe-area/navigation clearance, the 3-second entrance and reduced-motion handling. Use a more compact arrangement in short landscape viewports; notes remain editable for longer drafts without a visible textarea scrollbar.

Scope and validation are recorded in `today-status-card-sizing.md`. Only scoped CSS and these two packets change; no component or persistence changes. Manual QA targets: 320px/390px mobile, desktop, short landscape, populated deltas/errors, longer notes and page/navigation use while open. These visual checks remain unverified under the current no-browser gate.

Implemented compact inline score captions/buttons with deltas and errors retained, paired fields, a two-line notes area and shared Save/Skip footer. The panel now sizes to its form rather than a 60dvh/520px scrolling cap. Short landscape arranges the three score groups across a row and notes beside the paired fields. No panel/body clipping or hidden form controls; longer notes retain native editing behavior without a visible textarea scrollbar. Tests: **32 passed, 0 failed, 0 skipped** across the three affected focused suites; diff check and CSS parse/scope comparison passed. Visual fit remains pending, especially unusually short viewports, expanded errors, text zoom and software-keyboard resizing. Non-modal behavior, handlers and 3-second entrance are unchanged.
