'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { ADMIN_USER_ID } from '../../lib/constants'
import { activeTab } from '../../lib/tabs'
import ThemeToggle from '../ThemeToggle'
import AppIcon, { type IconName } from './AppIcon'

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: '/protocol', label: 'Today', icon: 'today' },
  { href: '/protocol/manage', label: 'Protocols', icon: 'protocols' },
  { href: '/timeline', label: 'Timeline', icon: 'timeline' },
  { href: '/health', label: 'Health', icon: 'health' },
]

export default function BottomTabBar() {
  const pathname = usePathname()
  const selected = activeTab(pathname)
  const dialog = useRef<HTMLDialogElement>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  useEffect(() => {
    let live = true
    createClient().auth.getUser().then(({ data: { user } }) => { if (live) setIsAdmin(user?.id === ADMIN_USER_ID) })
    return () => { live = false }
  }, [])
  function close() { dialog.current?.close(); setMoreOpen(false) }
  return <>
    <nav className="app-tab-bar" aria-label="Main navigation"><div className="app-tabs">
      {tabs.map(tab => <Link key={tab.href} href={tab.href} className="app-tab" aria-current={selected === tab.label ? 'page' : undefined} onClick={close}>
        <AppIcon name={tab.icon} /><span>{tab.label}</span>
      </Link>)}
      <button type="button" className="app-tab" data-active={selected === 'More' || moreOpen} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => { dialog.current?.showModal(); setMoreOpen(true) }}>
        <AppIcon name="more" /><span>More</span>
      </button>
    </div></nav>
    <dialog ref={dialog} className="app-more-sheet" aria-labelledby="more-title" onClose={() => setMoreOpen(false)} onClick={event => { if (event.target === event.currentTarget) close() }}>
      <header className="today-section-heading"><h2 id="more-title">More from MyPepProtocol</h2><button type="button" className="app-icon-button" aria-label="Close menu" onClick={close}><AppIcon name="close" /></button></header>
      {[
        ['/profile', 'Profile & settings'], ['/calculator', 'Dose calculator'],
        ['/tracker', 'Tracker'], ['/learn', 'Learn'],
        ...(isAdmin ? [['/admin', 'Admin']] : []),
      ].map(([href, label]) => <Link key={href} className="app-menu-link" href={href} onClick={close}>{label}<AppIcon name="chevron" size={16} /></Link>)}
      <div className="app-menu-link"><span>Appearance</span><ThemeToggle inline /></div>
    </dialog>
  </>
}
