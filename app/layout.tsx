import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import './mobile-app.css'
import AppShell from '../components/app/AppShell'
import { publicReleaseIdentifier } from '../lib/appRelease'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#090e16' }

const description = 'Private longitudinal health and protocol tracking.'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.mypepprotocol.app'),
  applicationName: 'MyPepProtocol',
  title: { default: 'MyPepProtocol', template: '%s | MyPepProtocol' },
  description,
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MyPepProtocol' },
  icons: {
    icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'MyPepProtocol',
    title: 'MyPepProtocol',
    description,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyPepProtocol',
    description,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <head>
        <script dangerouslySetInnerHTML={{__html:"(function(){try{var t=localStorage.getItem('protocol-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"}} />
      </head>
      <body className={inter.className} data-app-release={publicReleaseIdentifier()}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
