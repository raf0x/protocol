import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNav from '../components/BottomNav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Protocol',
  description: 'Your personal wellness protocol tracker',
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
      </head>
      <body className={inter.className} style={{background:'#030712',paddingBottom:'80px'}}>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
