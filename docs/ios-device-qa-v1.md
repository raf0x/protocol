# iOS real-device QA V1

This is an executable release checklist, not an automated production-data script. Use only disposable accounts and fictional records. Never run deletion, rate-limit, or failure tests against a real user account.

## Test record

Create one row per device/mode/build.

| Field | Value |
| --- | --- |
| Tester |  |
| Date/time |  |
| Build shown in Profile |  |
| Commit/deployment |  |
| Environment and Supabase project |  |
| Device model |  |
| iOS version |  |
| Safari version |  |
| CSS viewport width | 390px / 393px / 430px |
| Mode | Safari / Home Screen PWA |
| Network | Normal / Slow / Offline |
| Result | Pass / Fail / Blocked |
| Evidence or issue link |  |

Run the core matrix at 390px, 393px, and 430px in Safari and installed Home Screen mode. Run landscape where marked. Use a clean disposable account for destructive tests and a second disposable account to verify isolation.

## A. Install, launch, shell, and safe areas

- [ ] Open the production HTTPS URL in Safari. Confirm no install UI claims the app is already installed.
- [ ] Add to Home Screen. Confirm the green `P` is crisp, centered, not clipped, and has no transparent/white corner artifact.
- [ ] Launch from Home Screen. Confirm the launch background is near-black/navy and the first authenticated route is `/protocol` after login.
- [ ] Verify portrait at 390px, 393px, and 430px: no horizontal scroll, clipped card, or content under the tab bar/home indicator.
- [ ] Rotate Today, Protocols, Timeline, Health, and Profile to landscape. Confirm all controls remain reachable and no orientation lock exists.
- [ ] Tap every bottom tab. Confirm a minimum 44px target, correct selected state, non-color selected meaning, and no content occlusion.
- [ ] Open More. Confirm focus moves into the modal, background interaction is blocked, the close control is named, content scrolls below the top safe area, and Privacy/support links work.
- [ ] Enable Reduce Motion in iOS. Confirm nonessential transitions stop and content remains present.

## B. Authentication and sessions

- [ ] From signed out `/timeline?filter=weight`, enter a valid disposable email. Confirm the email keyboard does not zoom the page.
- [ ] Request the six-digit code once. Confirm loading and the 60-second resend cooldown are clear.
- [ ] Open the email app, return to Safari/PWA, and enter the code using one-time-code autofill and manually.
- [ ] Confirm successful login returns to `/timeline?filter=weight`, not only `/protocol`.
- [ ] Enter an expired/incorrect code. Confirm a calm error, a reachable “Use a different email” 44px action, and no stuck loading state.
- [ ] Close and reopen Safari, then the installed app. Confirm the session persists or returns cleanly to login without a permanent spinner.
- [ ] Expire/revoke the disposable session from Supabase, reopen a protected deep link, and confirm login recovery preserves the internal destination.
- [ ] Attempt `next=https://example.com` and `next=//example.com`. Confirm both return to `/protocol` and never redirect off-origin.
- [ ] With the keyboard open on login, protocol edit, lab edit/import, and AI question, confirm the focused control and primary action remain reachable.

## C. Core product smoke test

- [ ] Today loads fictional active protocols and next-dose state without a technical conversion error.
- [ ] Mark a fictional scheduled dose taken, refresh, and confirm the saved state.
- [ ] Open Protocols, create an incomplete fictional protocol, save it, reopen it, and confirm save-first warnings are non-blocking.
- [ ] Edit one fictional protocol and verify phases, schedule, administration, inventory, and notes remain intact.
- [ ] Timeline loads, filters, month/day grouping, and deep links work.
- [ ] Health loads empty, one-panel, and multi-panel states.
- [ ] Add/edit/delete one fictional lab panel. Confirm no horizontal overflow with the keyboard open.
- [ ] Open a biomarker trend and protocol overlay. Confirm charts have adjacent text summaries and are not color-only.

## D. Network, offline, and deployment lifecycle

- [ ] Throttle to a slow mobile connection. Cold-open Today, Timeline, Health, and protocol detail. Confirm truthful loading states and no false success.
- [ ] While online, install/open the PWA. Go offline and navigate. Confirm the static offline explanation appears and no cached private health history is shown.
- [ ] Drop the connection immediately before a disposable write. Confirm the UI reports failure or leaves the change unsaved. Restore the connection and confirm the offline banner clears.
- [ ] Deploy a harmless staging build change. Reopen and background/foreground the installed app. Confirm it updates once, has no repeated reload loop, and no `ChunkLoadError` persists.
- [ ] Record Profile’s short build identifier before and after deployment and confirm it changes.

## E. AI consent and failure handling

Use fictional data and an account with no prior AI permission.

- [ ] Open AI Health Analyst and submit a question. Confirm the consent dialog appears before any analyst API request.
- [ ] With Safari Web Inspector Network open, choose Cancel. Confirm no `/api/health-analyst` request is sent.
- [ ] Grant permission. Confirm the pending question runs once and evidence/limitations are visible.
- [ ] Ask again. Confirm permission is remembered and no duplicate consent dialog appears.
- [ ] Revoke permission in Profile. Retry the API from the UI and confirm the server returns the consent-required state before provider transmission.
- [ ] Confirm Labs browsing and the deterministic report still work after revocation.
- [ ] In staging only, remove/invalidates the AI provider configuration. Confirm a calm retryable unavailable state and no health-record mutation.
- [ ] Restore configuration and confirm recovery.

## F. Doctor report and PDF

- [ ] Generate deterministic 30-day, 90-day, and all-history reports from fictional data.
- [ ] If AI permission is granted, request the optional summary. Confirm provider failure leaves the deterministic report usable.
- [ ] Open Print/Save as PDF in Safari and installed mode. Confirm app navigation and export controls are absent.
- [ ] Inspect every PDF page: white background, readable contrast, no clipped tables/charts, sensible page breaks, and no blank trailing page.
- [ ] Cancel and complete the iOS share/save flow. Confirm the app resumes safely both times.

## G. Account deletion with disposable accounts

Prepare accounts `review-delete-A` and `review-isolation-B` with distinct fictional records. Record row counts by owner before testing. Never use a personal account.

- [ ] Open Profile for account A and verify the Delete button has an accessible name.
- [ ] Open confirmation. Confirm deletion is disabled until the exact word `DELETE` is entered.
- [ ] Cancel once. Confirm nothing changes.
- [ ] Confirm deletion. Verify account A’s application records are removed, the auth user is removed, local storage/caches clear, and the app returns signed out.
- [ ] Attempt to sign in/use the old session for A. Confirm prior data is inaccessible.
- [ ] Sign in as B and compare its before/after row counts and records. Confirm B is untouched.
- [ ] Inspect only scrubbed operational metadata for failures. Do not copy health rows into an issue report.

## H. Rate-limit QA

Run against staging or an explicitly approved disposable production account. Keep production limits unchanged. Use one endpoint at a time and record response headers in Safari Network or an authenticated API client.

- [ ] Health Analyst: send valid requests until the configured window is exceeded. Confirm HTTP 429 and a positive `Retry-After`.
- [ ] AI report: repeat valid AI report requests to its separate bucket. Confirm 429 and `Retry-After`.
- [ ] Deterministic report: repeat valid non-AI report requests to its bucket. Confirm 429 and `Retry-After` without affecting analyst capacity.
- [ ] Push subscription: only in staging with the feature gate understood, submit valid subscription-shaped requests until limited. Confirm 429 and `Retry-After`.
- [ ] Sign in as a second disposable user during the first user’s blocked window. Confirm the second user is not limited by the first.
- [ ] Wait the returned interval and confirm the original user recovers.

## I. Monitoring QA

Use a staging release. Query `app_error_events` with an authorized operational account after each test.

- [ ] Controlled API event: POST `/api/monitor` while authenticated with `{ "route": "/qa/controlled", "errorType": "DeviceQaControlledError", "source": "client", "status": 500 }`.
- [ ] Controlled client event: in a staging-only local branch, throw from a temporary render action, verify the recoverable error boundary, then discard the temporary change.
- [ ] Provider failure: temporarily remove the staging AI key or select a deliberately invalid staging endpoint/model configuration, make one fictional request, then restore configuration.
- [ ] Confirm rows contain only route, sanitized error type, numeric status, release, timestamp, random request ID, and source.
- [ ] Search stored custom-event columns and hosting logs for the fictional sentinel strings placed in lab value, protocol dose, journal note, AI question, and evidence. Confirm none appear in the custom event. Escalate any platform-log appearance for provider/privacy review.
- [ ] Confirm no auth token, cookie, API key, request body, error message, or stack is present.
- [ ] Confirm monitoring failures do not replace the user-facing recovery path.

## J. Accessibility

- [ ] VoiceOver: traverse Today, all tabs, More, Protocols, Timeline filters/events, Health, AI consent, and Delete Account in reading order.
- [ ] Confirm icon-only controls have useful names and decorative icons are ignored.
- [ ] Confirm modal dialogs announce title/content, keep interaction inside, and return focus to the trigger after closing.
- [ ] Confirm dose/status/trend meaning is available in text, not only color or chart position.
- [ ] Test Larger Text at 135% and 200%. Record truncation as a packaging blocker where controls or critical health values become inaccessible. The web app does not yet claim full Dynamic Type support.
- [ ] Use an external keyboard: verify visible focus, logical order, Enter/Space activation, and no keyboard trap.
- [ ] Measure primary controls and tab targets at 44×44 CSS px or larger.

## K. Performance sampling

Use Safari Web Inspector and one consistent device/network. Record, do not average away failures.

| Flow | Cold result | Warm result | Network/errors | Notes |
| --- | --- | --- | --- | --- |
| App launch/login gate |  |  |  |  |
| Today usable |  |  |  |  |
| Health usable |  |  |  |  |
| Timeline usable |  |  |  |  |
| Protocol detail usable |  |  |  |  |
| AI first response |  |  |  |  |
| Report rendered |  |  |  |  |

- [ ] Capture cold and warm timings, transferred bytes, failed requests, long main-thread tasks, and visible layout shifts.
- [ ] Confirm the PDF parser is not fetched until PDF import is chosen.
- [ ] Confirm AI Analyst does not fetch the Labs dashboard history before the analyst request.
- [ ] Confirm the legacy demo’s chart bundle does not load on authenticated routes.
- [ ] Repeat one run on Low Power Mode and one on a slow connection.

## Exit criteria

- [ ] All critical flows pass in Safari and installed mode at 390px, 393px, and 430px.
- [ ] No open blocker exposes another user’s data, loses a confirmed write, traps authentication, or prevents account deletion.
- [ ] Build identifier and evidence accompany every issue.
- [ ] Terms, support URL, privacy/provider confirmations, and reviewer account are ready.
- [ ] Push remains disabled unless every re-enable criterion passes.
- [ ] Final asset and screenshot review is signed off.
