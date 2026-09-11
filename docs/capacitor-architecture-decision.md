# Capacitor iOS architecture decision

Decision date: September 11, 2026

Status: ACCEPTED

This document records the MyPepProtocol V1 iOS wrapper architecture so the decision is not repeatedly reopened during implementation.

## Decision

Use a remote-hosted Capacitor WebView.

The native iOS shell loads:

https://www.mypepprotocol.app

through Capacitor `server.url`.

Application assets are not bundled into the native binary for V1.

Current Capacitor configuration:

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