'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import BottomNav from '../BottomNav'
import ThemeToggle from '../ThemeToggle'
import OfflineBanner from './OfflineBanner'
import PwaLifecycle from './PwaLifecycle'

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname()
  const publicPage = path === '/' || path.startsWith('/auth/') || path.startsWith('/share/') || path.startsWith('/demo') || path === '/privacy' || path === '/offline'
  if (publicPage) return <><PwaLifecycle />{children}<ThemeToggle /></>
  return <div className={`mobile-app-shell${path === '/protocol' ? ' today-surface' : ''}`}>
    <PwaLifecycle />
    <OfflineBanner />
    {children}
    <BottomNav />
  </div>
}
