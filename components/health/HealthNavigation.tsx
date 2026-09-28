'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import Link from 'next/link'
import styles from './health-navigation.module.css'

export type HealthView = 'overview' | 'labs' | 'changes' | 'analyst' | 'report' | 'import'
export const healthNavigationDestinations = [
  ['overview', 'Overview', '/health'], ['labs', 'Labs', '/health?view=labs'],
  ['changes', 'Protocol changes', '/health?view=changes'], ['analyst', 'AI Analyst', '/health?view=analyst'],
  ['report', 'Create report', '/health/report'],
] as const

export default function HealthNavigation({ active }: { active: HealthView }) {
  const row = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menuElement = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [menuPosition, setMenuPosition] = useState({ left: 12, top: 12, width: 280 })
  const menu = useId()
  const triggerId = useId()
  useEffect(() => {
    const navigation = row.current
    const selected = navigation?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!navigation || !selected) return
    const bounds = navigation.getBoundingClientRect(), item = selected.getBoundingClientRect()
    // Move only this horizontal strip, never the document or bottom tab bar.
    if (item.left < bounds.left) navigation.scrollLeft -= bounds.left - item.left + 6
    else if (item.right > bounds.right) navigation.scrollLeft += item.right - bounds.right + 6
  }, [active])
  useLayoutEffect(() => {
    if (!open) return
    const positionMenu = () => {
      const button = trigger.current
      if (!button) return
      const bounds = button.getBoundingClientRect()
      const width = Math.min(280, window.innerWidth - 24)
      const height = menuElement.current?.offsetHeight ?? 190
      const left = Math.min(Math.max(12, bounds.right - width), window.innerWidth - width - 12)
      const below = bounds.bottom + 6
      const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, bounds.top - height - 6)
      setMenuPosition({ left, top, width })
    }
    positionMenu()
    window.addEventListener('resize', positionMenu)
    window.addEventListener('scroll', positionMenu, true)
    const frame = window.requestAnimationFrame(() => menuElement.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', positionMenu)
      window.removeEventListener('scroll', positionMenu, true)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const dismiss = () => { setOpen(false); window.requestAnimationFrame(() => trigger.current?.focus()) }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !menuElement.current?.contains(target)) dismiss()
    }
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as Node
      if (!trigger.current?.contains(target) && !menuElement.current?.contains(target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); dismiss() }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])
  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(menuElement.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : -1
    if (target >= 0) { event.preventDefault(); items[target]?.focus() }
  }
  return <div className={styles.navigation}>
    <nav ref={row} className={styles.row} aria-label="Health views">
      {healthNavigationDestinations.map(([view, label, href]) => <Link key={view} href={href} aria-current={active === view ? 'page' : undefined} onClick={() => setOpen(false)}>{label}</Link>)}
      <button ref={trigger} id={triggerId} type="button" aria-current={active === 'import' ? 'page' : undefined} aria-haspopup="menu" aria-expanded={open} aria-controls={menu}
        onKeyDown={event => { if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setOpen(true) } }}
        onClick={() => setOpen(value => !value)}>Add / Import</button>
    </nav>
    {open && <div ref={menuElement} id={menu} className={styles.imports} role="menu" aria-label="Add or import lab results" aria-labelledby={triggerId}
      style={menuPosition} onKeyDown={onMenuKeyDown}>
      <Link role="menuitem" href="/health?action=add" onClick={() => setOpen(false)}><span>Add manually</span><small>Enter a health or lab result.</small></Link>
      <Link role="menuitem" href="/health?action=csv" onClick={() => setOpen(false)}><span>Import CSV</span><small>Upload structured health history.</small></Link>
      <Link role="menuitem" href="/health?action=pdf" onClick={() => setOpen(false)}><span>Import PDF</span><small>Upload a lab report.</small></Link>
    </div>}
  </div>
}
