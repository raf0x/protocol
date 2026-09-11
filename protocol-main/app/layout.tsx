import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import './mobile-app.css'
import AppShell from '../components/app/AppShell'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export const metadata: Metadata = {
  applicationName: 'MyPepProtocol',
  title: { default: 'MyPepProtocol', template: '%s | MyPepProtocol' },
  description: 'Private longitudinal health and protocol tracking.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'MyPepProtocol' },
  icons: { icon: '/icon-192.png', apple: '/icon-192.png' },
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
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
