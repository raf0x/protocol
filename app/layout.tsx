import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import './mobile-app.css'
import AppShell from '../components/app/AppShell'

const inter = Inter({ subsets: ['latin'] })

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' }

export const metadata: Metadata = {
  title: 'Protocol — Peptide & GLP-1 Protocol Tracker',
  description: 'Your personal wellness protocol tracker',
  manifest: '/manifest.json',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <head>
        <meta name='apple-mobile-web-app-capable' content='yes' />
        <meta name='apple-mobile-web-app-status-bar-style' content='black-translucent' />
        <meta name='apple-mobile-web-app-title' content='Protocol' />
        <link rel='apple-touch-icon' href='/icon-192.png' />
        <link rel='icon' type='image/png' href='/icon-192.png' />
        <script dangerouslySetInnerHTML={{__html:"(function(){try{var t=localStorage.getItem('protocol-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"}} />
      </head>
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
        <script dangerouslySetInnerHTML={{
          __html: `
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js')
                  .then(function(reg) { console.log('SW registered'); })
                  .catch(function(err) { console.log('SW error', err); })
              });
            }
          `
        }} />
      </body>
    </html>
  )
}
