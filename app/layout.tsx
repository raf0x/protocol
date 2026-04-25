import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '../components/BottomNav'
import ThemeToggle from '../components/ThemeToggle'

const inter = Inter({ subsets: ['latin'] })

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
        <meta name='viewport' content='width=device-width, initial-scale=1, viewport-fit=cover' />
        <link rel='apple-touch-icon' href='/icon-192.png' />
        <link rel='icon' type='image/png' href='/icon-192.png' />
        <script dangerouslySetInnerHTML={{__html:"(function(){try{var t=localStorage.getItem('protocol-theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"}} />
      </head>
      <body className={inter.className} style={{paddingBottom:'80px'}}>
        {children}
        <BottomNav />
        <ThemeToggle />
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