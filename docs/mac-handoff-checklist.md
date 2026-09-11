# Mac / Xcode handoff checklist

Updated September 11, 2026.

Windows-side Capacitor preparation is complete.

Follow this checklist in order when macOS/Xcode access becomes available.

Do not redesign the architecture during setup. The accepted decision is documented in:

`docs/capacitor-architecture-decision.md`

## Before using the Mac

Confirm:

- [ ] Apple Developer Program membership is active
- [ ] Bundle identifier `app.mypepprotocol.ios` is available/registered
- [ ] Apple Developer Team ID is recorded
- [ ] V1 is iPhone only
- [ ] V1 is portrait only
- [ ] `main` is current
- [ ] Production site is healthy

Current public URLs:

- Privacy: `https://mypepprotocol.app/privacy`
- Terms: `https://mypepprotocol.app/terms`
- Support: `https://mypepprotocol.app/support`

## Stage 1: Mac environment

Install Xcode from the Mac App Store.

Launch Xcode once and allow it to install required components.

Then verify:

```bash
xcodebuild -version