'use client'
import { useState, useEffect, useRef, useId } from 'react'
import { dateLabel } from '../../lib/health/protocolPresentation'
import { isCalendarDate } from '../../lib/health/protocolDates'
import styles from './VialInventory.module.css'

type Props = {
  presentation?: 'status'
  compoundId: string
  compoundName: string
  reconstitutionDate?: string | null
  bacWaterMl?: number
  vialStrength?: number
  vialUnit?: string
}

/** Release 4A containment: opening this dialog never reads or mutates saved records. */
export default function VialInventory({ presentation, compoundName, reconstitutionDate }: Props) {
  const [showNewVial, setShowNewVial] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()
  useEffect(() => {
    if (!showNewVial) return
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    dialog.querySelector<HTMLButtonElement>('button')?.focus()
    return () => { dialog.close(); triggerRef.current?.focus({ preventScroll: true }) }
  }, [showNewVial])
  const recordedDate = reconstitutionDate && isCalendarDate(reconstitutionDate) ? dateLabel(reconstitutionDate) : null
  return <div className="vial-inventory">
    <div className="vial-lifecycle">
      <span className="vial-lifecycle-title">{presentation === 'status' ? 'VIAL STATUS' : 'VIAL DETAILS'}</span>
      <span className="vial-lifecycle-status">{recordedDate ? 'Reconstituted ' + recordedDate : 'Reconstitution date not recorded'}</span>
      <p className={styles.expiration} aria-label="Expiration unknown. No expiration or beyond-use date is recorded for this vial.">Expiration unknown</p>
      <button ref={triggerRef} type="button" className="vial-new-button" onClick={() => setShowNewVial(true)} aria-haspopup="dialog" aria-controls={showNewVial ? dialogId : undefined}>+ New Vial</button>
    </div>
    {showNewVial && <dialog ref={dialogRef} id={dialogId} className={styles.newVialDialog} aria-modal="true" aria-labelledby={dialogId + '-title'} aria-describedby={dialogId + '-description'}
      onCancel={event => { event.preventDefault(); setShowNewVial(false) }}
      onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, a[href]'))
        const first = controls[0], last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
      <h3 id={dialogId + '-title'}>Starting a new vial is temporarily unavailable</h3>
      <p id={dialogId + '-description'}>To preserve your previous {compoundName} vial details, starting a replacement vial is paused until each vial can be saved separately. No stock, preparation details or dose counters have changed.</p>
      <p>Your existing protocols and recorded history are still available.</p>
      <div className={styles.actions}><button type="button" onClick={() => setShowNewVial(false)}>Close</button><a href="/protocol/manage">View protocols</a></div>
    </dialog>}
  </div>
}
