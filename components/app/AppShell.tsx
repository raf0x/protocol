'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import BottomNav from '../BottomNav'
import ThemeToggle from '../ThemeToggle'

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname()
  const publicPage = path === '/' || path.startsWith('/auth/') || path.startsWith('/share/') || path === '/privacy'
  if (publicPage) return <>{children}<ThemeToggle /></>
  return <div className={`mobile-app-shell${path === '/protocol' ? ' today-surface' : ''}`}>
    {children}
    <BottomNav />
  </div>
}
