# Capacitor iOS architecture decision

Decision date: September 11, 2026

This is the Phase 0 deliverable referenced in `docs/app-store-readiness.md`. It records the native wrapper architecture so implementation does not relitigate it. No Capacitor dependency is installed at the time of writing.

## Decision: remote-hosted WebView (`server.url`)

The native iOS shell loads `https://www.mypepprotocol.app` directly. Application assets are not bundled into the native binary for V1.

### Why

Auth is cookie-authoritative end to end today:

- `lib/supabase.ts` uses `createBrowserClient` from `@supabase/ssr` with no storage override, so the session lives in cookies.
- `lib/serverSupabase.ts` reads those same cookies through `next/headers`.
- `proxy.ts` reads them again to gate every protected route and refresh the session.

A remote-hosted WebView keeps the page origin identical to the API origin. Cookies persist in WKWebView's persistent `WKWebsiteDataStore`, which is the same storage model as Mobile Safari, so the mechanism already proven in production keeps working unchanged.

A bundled app served from `capacitor://localhost` makes every API call cross-origin. WebKit's cross-site cookie policy is unreliable for cookies set by a cross-origin `Set-Cookie` response, which is a well-documented failure mode for Capacitor combined with cookie-based Supabase auth. Making it work requires removing cookie authority entirely: bearer tokens in Keychain-backed storage, `Authorization` headers on every request, and a parallel bearer-verification path in `proxy.ts` and every protected route. That is a rewrite of the auth boundary, not a configuration change.

Capacitor's JS bridge injects into remote-loaded pages, so native plugin access is equivalent under both approaches. Bundling is therefore not required to obtain native capability.

### Accepted tradeoffs

- Offline capability remains what the existing service worker provides: a static `/offline` explanation, no stale health records. This matches the "Limited by design" position already recorded in `docs/app-store-readiness.md`.
- The app requires connectivity to launch into authenticated content.
- A remote-hosted wrapper carries more Guideline 4.2 thin-wrapper scrutiny. Mitigation is native capability (see below), not a change of hosting model.

### Revisit criteria

Reopen this decision only if physical-device testing shows cookie sessions do not survive the Phase 3 requirements. `lib/clientRuntime.ts` exists so a bearer-token client could be added alongside the cookie client behind `isNativeAppRuntime()` rather than replacing it.

## Identity

| Item | Value | Notes |
| --- | --- | --- |
| Bundle identifier | `app.mypepprotocol.ios` | Reverse-DNS of the owned production domain. Avoids `com.` squatting ambiguity and matches the domain used for Universal Links. Must be registered in the Apple Developer account before Associated Domains work. |
| App display name | `MyPepProtocol` | Matches `docs/app-store-metadata-draft.md` and `public/manifest.json`. Under the 12-character Home Screen truncation threshold is not achievable without a different name; accept truncation rather than introduce a second brand. |
| Orientation policy | Portrait only for V1 | `docs/ios-device-qa-v1.md` currently tests landscape and asserts no orientation lock, which is correct for the web/PWA surface. The native wrapper is a separate surface: the app shell, bottom tab bar, and sticky protocol controls are designed mobile-first portrait, and locking removes an entire class of native layout QA from V1. This is a deliberate divergence between web and native, not an inconsistency. Revisit if iPad distribution is kept. |
| iPad distribution | Decide before Phase 1 | `docs/ios-assets-and-screenshots.md` treats iPad as conditional. iPhone-only removes a full screenshot set and layout QA matrix from V1. Recommend iPhone-only for V1. |

## Link policy

| Link type | Behavior | Rationale |
| --- | --- | --- |
| Same-origin `www.mypepprotocol.app` | Stay in the WebView | These are ordinary in-app navigations. |
| External `https:` | Open in the system browser | Prevents the user navigating the WebView away from the app with no way back. None exist in `app/` or `components/` today, so this is forward policy. |
| `mailto:` | Hand to the native mail composer | Three call sites exist: `app/profile/page.tsx`, `app/privacy/page.tsx`, `components/app/BottomTabBar.tsx`. A `mailto:` loaded inside a WebView does nothing useful. |
| `tel:` | Hand to the native dialer | None exist today. Policy recorded for completeness. |
| Anything else | Blocked, no navigation | Default-deny. |

The allowlist is a single host comparison, not a rules engine. See `lib/nativeLinks.ts`.

## Deep-link strategy

Universal Links, not custom URL schemes. Custom schemes are hijackable by any other app and are not accepted for the share flow.

- Associated domain: `applinks:www.mypepprotocol.app`
- Highest-value target: the existing protocol share-token routes (`/share/...`), which are already public in `proxy.ts` and already generate shareable links in `app/protocol/page.tsx`. This improves a shipped feature rather than inventing one.
- Also route: `/protocol`, `/timeline`, `/health`.
- `apple-app-site-association` must be served from `https://www.mypepprotocol.app/.well-known/apple-app-site-association` as `application/json` with no redirect. It requires the Team ID, so the file content cannot be finalised until the Apple Developer account exists.
- Login deep-link preservation already works (`proxy.ts` sets `next`, validated same-origin). Native deep links inherit it.

## Native capability for Guideline 4.2

Ordered by genuine product value, not decoration. None are required for Phase 1.

1. Native share sheet for Doctor Report PDF export. Converts a browser download into a real iOS interaction.
2. Universal Links for protocol share tokens. Improves an existing feature.
3. Native haptics replacing `navigator.vibrate()`, which silently no-ops on iOS Safari today. Strict upgrade, no new UX scope.
4. APNs push, only after every criterion in `docs/push-v1-decision.md` passes. Deliberately out of V1.
5. Face ID app lock. Genuinely valuable for a health-data app and unambiguously native. New scope; sequence separately.

Explicitly rejected: simulated native chrome, decorative splash animation, any feature whose only purpose is to look native.

## Auth strategy for V1

No change. Cookie-based Supabase sessions remain authoritative. No bearer tokens, no Keychain, no API route changes, no `proxy.ts` changes, no database migration.

Phase 3 validates, on a physical device, that login survives force close, app restart, backgrounding, refresh-token expiry, and network loss then reconnect.
