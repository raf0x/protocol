'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRef, useState } from 'react'
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
  const [moreOpen, setMoreOpen] = useState(false)
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
        ['/profile', 'Profile & settings'],
        ['/learn', 'Learn'],
        ['/privacy', 'Privacy policy'], ['/support', 'Support'],
      ].map(([href, label]) => <Link key={href} className="app-menu-link" href={href} onClick={close}>{label}<AppIcon name="chevron" size={16} /></Link>)}
      <div className="app-menu-link"><span>Appearance</span><ThemeToggle inline /></div>
    </dialog>
  </>
}
