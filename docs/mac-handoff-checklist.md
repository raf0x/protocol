# Mac / Xcode handoff checklist

Prepared September 11, 2026, while no macOS access exists. Follow in order. Do not skip the verification gates. Architecture is already decided in `docs/capacitor-architecture-decision.md`; do not relitigate it at the keyboard.

## Before touching the Mac

- [ ] Apple Developer Program membership is active (99 USD/year).
- [ ] Bundle identifier `app.mypepprotocol.ios` is registered as an App ID.
- [ ] Team ID is recorded. It is required for `apple-app-site-association`.
- [ ] iPad distribution decision is confirmed. Recommended: iPhone only for V1.
- [ ] `main` is green: lint, tests, and build pass on Windows.

## Stage 1: Mac environment

Xcode is a multi-gigabyte download. Start it first and do other work while it installs.

- [ ] Install Xcode from the Mac App Store.
- [ ] Launch Xcode once and accept the license, then let it install additional components.
- [ ] `xcode-select --install`
- [ ] `sudo xcodebuild -license accept`
- [ ] `xcodebuild -version` prints a version.
- [ ] Install Node 20 or newer: `node --version`
- [ ] Install CocoaPods: `sudo gem install cocoapods` then `pod --version`

Gate: all four version commands print successfully. Do not continue otherwise.

## Stage 2: Clone and verify the web app builds on macOS

```
git clone https://github.com/raf0x/protocol.git
cd protocol
npm install
```

Create `.env.local` on the Mac by hand from the production values. Do not copy it from a chat, email, or screenshot, and do not commit it. `.gitignore` already covers `.env*`.

```
npm run lint
npm run build
```

Gate: build succeeds on macOS before Capacitor is introduced. If it fails here, the failure is unrelated to Capacitor and must be fixed first.

## Stage 3: Install Capacitor

```
npm install --save-dev @capacitor/cli
npm install @capacitor/core @capacitor/ios
npx cap init "MyPepProtocol" "app.mypepprotocol.ios" --web-dir=public
```

`--web-dir` is required by the CLI but is not meaningfully used in a remote-hosted configuration. Then replace the generated `capacitor.config.ts` with:

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.mypepprotocol.ios',
  appName: 'MyPepProtocol',
  webDir: 'public',
  server: {
    url: 'https://www.mypepprotocol.app',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
}

export default config
```

```
npx cap add ios
npx cap sync ios
```

Gate: an `ios/` directory exists and `npx cap sync ios` completes without error.

Rollback: `rm -rf ios capacitor.config.ts` and uninstall the three packages. Production is untouched because nothing in `app/`, `components/`, or `lib/` changed.

## Stage 4: First simulator run

```
npx cap open ios
```

In Xcode: select an iPhone 16 simulator, set the signing team, press Run.

- [ ] App launches and shows the real production site.
- [ ] Login with a disposable account succeeds.
- [ ] Bottom tab navigation works.
- [ ] No service worker registers. `PwaLifecycle` should unregister it because `isNativeAppRuntime()` is now true.
- [ ] The "Install on iPhone" hint is absent.

Gate: login works in the simulator. This is the single most important early signal, because it confirms the cookie-auth decision in the architecture document.

## Stage 5: Portrait lock and native config

In Xcode target settings, or `Info.plist`:

- [ ] Device Orientation: Portrait only.
- [ ] Status bar style matches the dark app surface.
- [ ] Launch screen: solid `#090e16`, centered mark per `docs/ios-assets-and-screenshots.md`. No spinner, no version text, no simulated app screen.
- [ ] App icon from `public/app-store-icon-1024.png`, after final owner approval.

## Stage 6: Physical device auth validation

This is the Phase 3 gate from the architecture document. No code changes are expected here; this is validation.

- [ ] Login on a real iPhone.
- [ ] Force close the app, reopen. Session persists.
- [ ] Background for 30+ minutes, reopen. Session persists.
- [ ] Airplane mode on, navigate, airplane mode off. Recovers without a permanent spinner.
- [ ] Leave the app overnight, reopen. Refresh token rotates successfully.
- [ ] Revoke the session in Supabase, reopen a protected deep link. Returns to login preserving the destination.

Gate: all six pass. If sessions do not persist, stop and reopen the architecture decision rather than patching symptoms.

## Stage 7: Native behavior gaps

Test in this order and only build the fallback if the cheap path fails.

- [ ] `window.print()` in Doctor Report. Does the native print/share sheet appear? If yes, ship unchanged and add no dependency.
- [ ] CSV export from Today and Protocols. Does the Blob download produce a usable file? Blob-URL downloads are commonly unreliable in WKWebView.
- [ ] `navigator.clipboard.writeText` on protocol share and calculator share.
- [ ] `mailto:` links in Profile, Privacy, and the More sheet.

For each failure, wire `lib/nativeLinks.ts` (already written and tested) and add only the specific plugin needed:

- external links and `mailto:` → `@capacitor/browser`
- file save and share → `@capacitor/filesystem` and `@capacitor/share`
- clipboard → `@capacitor/clipboard`

Do not install these preemptively.

## Stage 8: Full device QA

Execute `docs/ios-device-qa-v1.md` against the native build. It was written for Safari and installed PWA modes; treat the native shell as a third mode in the test record. Skip the landscape cases because V1 is portrait-locked, and record that as an intentional deviation.

## Stage 9: TestFlight

- [ ] App Store Connect app record created with `app.mypepprotocol.ios`.
- [ ] Terms of Use published and linked. Still open.
- [ ] Support URL published. Still open. `docs/app-store-metadata-draft.md` explicitly warns not to submit the placeholder.
- [ ] App Privacy answers completed from `docs/app-privacy-draft.md` and reconciled against the native build's actual network behavior.
- [ ] `PrivacyInfo.xcprivacy` added if any required-reason API is used.
- [ ] Screenshots captured per `docs/ios-assets-and-screenshots.md` from the fictional reviewer account.
- [ ] Reviewer notes written from the outline in `docs/app-store-metadata-draft.md`.
- [ ] Archive and upload. Internal tester install verified.

## Deferred beyond V1

- Universal Links. Needs the Team ID, the `apple-app-site-association` file at `/.well-known/`, and the Associated Domains entitlement.
- APNs push. Blocked by every criterion in `docs/push-v1-decision.md`.
- Native haptics, Face ID lock.
