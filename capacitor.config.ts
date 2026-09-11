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