'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SecondaryAction } from '../app/DesignSystem'
import AppIcon from '../app/AppIcon'
import styles from '../../app/protocol/today-v2.module.css'

// UI memory only: dismissing lasts across client navigation in this app session.
// Saved journal data remains the authority after a reload; no new storage/write path.
const promptedDay = new Map<string, string>()

export default function DailyCheckInPrompt({ ownerId, date, recorded, children }: {
  ownerId: string | null; date: string; recorded: boolean; children: ReactNode | ((dismiss: () => void) => ReactNode)
}) {
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const focusOnOpen = useRef(false)
  const focusOnClose = useRef(false)
  useEffect(() => {
    if (!ownerId || recorded || promptedDay.get(ownerId) === date) return
    promptedDay.set(ownerId, date)
    setOpen(true)
  }, [ownerId, date, recorded])

  useEffect(() => {
    if (open && focusOnOpen.current) {
      panel.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
      focusOnOpen.current = false
    }
    if (!open && focusOnClose.current) {
      trigger.current?.focus({ preventScroll: true })
      focusOnClose.current = false
    }
  }, [open])

  function openPanel() {
    if (open) panel.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
    else {
      focusOnOpen.current = true
      setOpen(true)
    }
  }

  function dismissPanel() {
    // Closing must not interrupt someone who has already moved back to the page.
    focusOnClose.current = !!panel.current?.contains(document.activeElement)
    setOpen(false)
  }

  return <>
    <SecondaryAction ref={trigger} className={styles.checkinReopen} hidden={open || !ownerId} onClick={openPanel} aria-haspopup="dialog" aria-controls="daily-checkin-panel" aria-expanded={open}><AppIcon name="health" size={16} />Review check-in</SecondaryAction>
    <p className={styles.visuallyHidden} role="status">{open ? 'Daily check-in is open at the bottom. You can keep using the page.' : ''}</p>
    {open && <div ref={panel} id="daily-checkin-panel" role="dialog" aria-modal="false" className={styles.checkinPanel} aria-labelledby="checkin-dialog-title" aria-describedby="checkin-dialog-hint"
      onKeyDown={event => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault()
          dismissPanel()
        }
      }}>
      <span className={styles.checkinPanelHandle} aria-hidden="true" />
      <header className={styles.checkinPanelHeader}>
        <div><h2 id="checkin-dialog-title" tabIndex={-1}>{recorded ? 'Your daily check-in' : 'Log your daily check-in'}</h2><p id="checkin-dialog-hint">Scores save on tap. Save other entries below.</p></div>
        <button type="button" aria-label="Close daily check-in" className="app-icon-button" onClick={dismissPanel}><AppIcon name="close" /></button>
      </header>
      <div className={styles.checkinPanelBody}>
        {typeof children === 'function' ? children(dismissPanel) : children}
        <button type="button" className={styles.checkinDismiss} onClick={dismissPanel}>{recorded ? 'Done' : 'Skip for now'}</button>
      </div>
    </div>}
  </>
}
