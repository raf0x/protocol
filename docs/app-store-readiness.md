# MyPepProtocol App Store Readiness Audit + Stabilization V1

Audit date: September 10, 2026

## Decision

Use the enhanced PWA as the production web foundation and test surface now. Plan a Capacitor iOS wrapper after the blockers in this document are closed. Capacitor is the recommended distribution direction because App Store presence is an explicit goal and the product will benefit from a controlled native lifecycle, universal links, and future native notification integration. Do not begin wrapper work while core privacy, account deletion, monitoring, and device QA remain open.

Apple can reject a wrapper that is only a repackaged website. The native package must preserve the app-like product experience and be tested against [App Review Guideline 4.2](https://developer.apple.com/app-store/review/guidelines/#minimum-functionality). Capacitor setup guidance is maintained in the [official iOS documentation](https://capacitorjs.com/docs/ios).

## Implemented in this pass

- Updated manifest identity, launch route, scope, colors, categories, and icon purpose.
- Removed broad service-worker caching. Authenticated pages, API responses, and health data are never put in the service-worker cache.
- Added a static offline explanation, online/offline banner, old-cache cleanup, service-worker update checks, and one-attempt stale-chunk recovery.
- Added security and service-worker cache headers.
- Preserved authenticated deep-link destinations through login and callback with same-origin path validation.
- Added bounded session checks on the public landing and login screens.
- Added dynamic-viewport and safe-area refinements for the app shell, bottom sheet, sticky protocol controls, login, error, privacy, and offline screens.
- Made VAPID setup lazy and validated so absent push configuration returns a controlled 503 instead of breaking module evaluation or builds.
- Added push payload size/shape validation, user-scoped throttling, safer reminder-hour handling, and sanitized provider errors.
- Avoided an unnecessary Labs history request when opening AI Analyst directly.
- Added an iPhone installed-mode hint and truthful notification capability guidance.
- Updated the privacy page to cover current Labs, AI, report, import, push, and provider data flows without claiming a nonexistent deletion control.

## Current readiness by area

| Area | Status | Finding |
| --- | --- | --- |
| Manifest/installability | Stabilized | Valid standalone manifest with 192px and 512px placeholders. HTTPS is still required in production. |
| Service worker | Stabilized | Shell-only fallback; private records are network-only. |
| Update lifecycle | Stabilized | Update checks on visibility, pageshow, and reconnect; one controlled chunk-recovery reload. |
| Offline | Limited by design | Honest offline warning and static fallback. No stale health data is presented as current. Writes are not queued. |
| Auth/session | Code-ready, device QA needed | Cookie session and proxy refresh are sound. Deep-link return is preserved. Close/reopen and expiry still require live iPhone tests. |
| Mobile shell | Code-ready, device QA needed | Safe-area and dynamic viewport handling are present. Keyboard and rotation require real-device verification. |
| PDF/report | Browser-dependent | Uses Safari Print and Save as PDF. Print controls are hidden and report content is light-themed. Physical-device pagination/chart QA is required. |
| AI routes | Stabilized | Authenticated, owner-scoped, request-capped, timed out, and server-keyed. Durable throttling and monitoring remain open. |
| Push | Not production-ready | User permission exists and installed iOS supports Web Push on iOS/iPadOS 16.4+. Scheduling is server-hour based and lacks user timezone; expired subscriptions are not removed. |
| Privacy/legal | In progress | Factual public policy updated. Terms, explicit third-party AI permission, legal review, and in-app account deletion remain open. |
| Monitoring | Not ready | No centralized production crash/API monitoring or alerts. |
| Rate limiting | Not ready | In-memory limiter is per process and resets. It is not a distributed production control. |
| Accessibility | Baseline present | Semantic navigation, focus states, 44px targets, text status, labels, and reduced motion exist in primary modern screens. Full VoiceOver audit remains open. |

## iPhone QA matrix

Run every case at 390px, 393px, and 430px widths unless marked otherwise. Record device, iOS version, Safari version, build ID, result, screenshot, and issue link.

| Scenario | Safari browser mode | Installed PWA mode | Expected result |
| --- | --- | --- | --- |
| Fresh launch, portrait | Required | Required | No horizontal scroll; header and first action clear; bottom nav does not cover content. |
| Landscape | Required | Required | Content remains reachable; no clipped sheets; no orientation lock. |
| Keyboard on login code | Required | Required | Focused field and Sign in action remain reachable; no zoom from sub-16px inputs. |
| Keyboard on protocol editor | Required | Required | Sticky Save remains reachable without covering the focused field. |
| Keyboard on lab import/edit | Required | Required | Dialog/form scrolls independently and focused field is visible. |
| More sheet | Required | Required | Sheet stays below top safe area, scrolls, closes by button/backdrop, and traps modal interaction. |
| Bottom navigation | Required | Required | All five tabs have 44px+ targets and remain above the home indicator. |
| Fresh login | Required | Required | Email code succeeds and returns to requested authenticated route. |
| Invalid/expired code | Required | Required | Calm recoverable message; resend remains available. |
| Returning session | Required | Required | Close/reopen returns to authenticated app without a permanent loading screen. |
| Expired token | Required | Required | Proxy/Supabase refreshes the session or returns to login with the original deep link. |
| Direct `/timeline` deep link | Required | Required | Signed-out user returns to `/timeline` after login. |
| Slow 3G navigation | Required | Required | Existing loading state is visible; controls do not report false success. |
| Temporary offline launch | Required | Required | Static offline explanation appears; no cached health history is shown. |
| Connection drops during write | Required | Required | Write reports failure or remains unsaved; reconnect banner clears when online. |
| New production deployment | Required | Required | Service worker updates without repeated reloads or ChunkLoadError loop. |
| AI timeout/provider failure | Required | Required | Calm retryable error; recorded health data remains unchanged. |
| Report generation failure | Required | Required | Error state is visible and retry works. |
| Print report | Required | Required | App controls are absent; white report is readable; no clipped tables/charts; page breaks are sensible. |
| Save as PDF | Required | Required | Safari share/print flow produces a readable PDF and returns safely to app. |
| Notification permission | Not expected in tab | Required on iOS 16.4+ | Permission is requested only from the Profile action and denial remains recoverable. |
| Push notification tap | Not expected in tab | Required | App opens/focuses and routes to an internal destination. |
| Dark/light appearance | Required | Required | System/status areas and content remain legible; no flash makes health data unreadable. |
| VoiceOver + keyboard | Required | Required | Navigation, forms, dialogs, charts, errors, and statuses have understandable names/order. |
| Reduce Motion | Required | Required | Nonessential animation is disabled without hiding content. |

## App Privacy draft mapping

This is a code-derived draft, not a submission or legal determination. Confirm production providers, retention, server logs, and the final native wrapper before completing App Store Connect. Apple requires all app and third-party collection to be declared and kept current in [App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/).

| Apple category | Likely data | Linked to user | Purpose | Review note |
| --- | --- | --- | --- | --- |
| Health & Fitness | Protocols, dosing/administration, journal metrics, weight, lab panels/results | Yes | App functionality; user-requested analytics | Sensitive health data. Not used for advertising/tracking. |
| Contact Info | Email address | Yes | Authentication, account management | Confirm authentication email processor. |
| Identifiers | Supabase user ID, push subscription endpoint/token | Yes | App functionality, notifications, security | Confirm how Apple classifies browser push tokens in wrapper. |
| User Content | Freeform notes, imported report content/filename | Yes | App functionality; user-requested AI/report processing | Confirm whether import source files ever reach a server in production. Current parsing is client-side. |
| Usage Data | Feature requests and server request metadata | Uncertain | Security/operations | No analytics SDK was found. Confirm Vercel/Supabase logs and any future monitoring SDK. |
| Diagnostics | Crash/error and performance data | Not currently collected by an app SDK | Reliability | Revisit when monitoring is installed and disclose its SDK collection. |

The code shows no advertising SDK, cross-app tracking, or sale of personal data. Verify actual production configuration before making those representations publicly.

## Privacy and legal launch checklist

- Obtain counsel review of Privacy Policy and create Terms of Use.
- Add an explicit, understandable permission step before first third-party AI transmission. Apple’s guidelines require clear disclosure and explicit permission for personal data shared with third-party AI.
- Implement in-app account deletion, including reauthentication, dependent-record deletion, cancellation/error recovery, and an audit-safe operational process. Apple requires deletion in apps that support account creation.
- Confirm controller/business identity, support URL, privacy URL, contact details, age rating, jurisdictions, retention, backup deletion, and incident-response process.
- Confirm Supabase region/encryption/RLS, Resend role, OpenAI API data controls, Vercel logs, push provider behavior, and all subprocessors.
- Prepare a reviewer demo account or complete demo mode with fictional health data.
- Review health and dosage positioning with counsel. Apple applies additional scrutiny to medical information and dosage calculators under Guidelines 1.4 and 5.1.3.

## Production controls still required

1. Replace the in-memory rate limiter with a distributed limiter keyed by authenticated user and route, with IP-based protection for unauthenticated endpoints. Vercel WAF or a small durable KV/Redis service are appropriate candidates.
2. Add centralized client/server/API monitoring with PII and health-data scrubbing, release/build tagging, alerting, and source maps. A minimal Sentry setup or equivalent is sufficient.
3. Add user timezone to notification scheduling or use a native/local-notification strategy. Remove expired 404/410 push subscriptions and add delivery observability.
4. Implement in-app account deletion and reviewed legal surfaces.
5. Produce a final 1024px App Store icon, dedicated 180px Apple touch icon, native launch screen assets, App Store screenshots, support URL, and metadata using fictional data.
6. Complete the device matrix and TestFlight review on currently supported iPhone and iPad sizes.

## Environment checklist

Required core values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Required for server-side administrative notification jobs:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Required only when push is enabled:

- `VAPID_EMAIL` as a `mailto:` or HTTPS URI
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Required only when AI features are enabled:

- `OPENAI_API_KEY`
- Any optional model environment variables already documented by the AI services

Missing optional feature configuration must result in a controlled unavailable state, not a build failure. Never expose service-role, cron, VAPID private, or OpenAI keys with a `NEXT_PUBLIC_` prefix.

## Icon and launch asset inventory

| Asset | Current | Required action |
| --- | --- | --- |
| PWA 192px PNG | Present | Replace placeholder with final approved identity before public launch. |
| PWA 512px PNG | Present | Replace placeholder with final approved identity before public launch. |
| Maskable safe area | Existing artwork appears centered | Verify on Android/iOS install previews. |
| Apple touch 180px | Missing | Export a dedicated 180×180 PNG. |
| App Store icon | Missing | Export an opaque 1024×1024 final icon without transparency. |
| Native launch screen | Missing | Design after the Capacitor shell exists; avoid static device-specific splash hacks in the PWA. |
| App Store screenshots | Missing | Capture required device sizes with fictional account data only. |

## PDF notes

The current browser-print implementation is the lowest-risk approach. It excludes navigation and export controls, uses a white clinician document, applies print page avoidance to grouped rows, and has compact mobile styles. iOS Safari controls the actual Save as PDF path and pagination, so automated browser-width tests cannot prove the final PDF. Do not add a large PDF generation stack unless physical-device testing demonstrates a repeatable blocking defect.

## Security notes

- Authenticated application queries and AI/report loaders are owner-scoped in current code.
- OpenAI and service-role secrets remain in server modules; only the VAPID public key is client-exposed by design.
- Model output is rendered as React text, not arbitrary HTML.
- The service worker does not cache private application responses.
- API input validation is present for AI, reports, and push, but a complete penetration/security review is outside this pass.
- File imports are parsed client-side and require user review before persistence. Revalidate size/type behavior on mobile Safari.

## Ready for iOS packaging?

No.

Blockers:

1. In-app account deletion is absent.
2. Privacy/Terms and explicit third-party AI permission need legal/product completion.
3. Rate limiting is not durable across production instances.
4. Centralized privacy-scrubbed production monitoring is absent.
5. Push scheduling/cleanup is not production-ready if push is included.
6. Final iOS icons, launch assets, and metadata are missing.
7. The physical-device QA matrix and TestFlight validation are incomplete.
