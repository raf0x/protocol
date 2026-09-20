'use client'

import { useState } from 'react'
import { transitionProtocol } from '../../lib/health/protocolMutations'
import { validDate } from '../../lib/health/dosingEntry'
import ProtocolDialog from './ProtocolDialog'

export default function ActivateProtocol({ protocol, onActivated }: {
  protocol: { id: string; name: string | null }; onActivated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function activate() {
    if (busy) return
    if (!validDate(date)) { setError('Choose a valid start date.'); return }
    setBusy(true); setError('')
    try {
      await transitionProtocol({ protocolId: protocol.id, action: 'activate', effectiveDate: date })
      setOpen(false); onActivated()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to activate protocol.') }
    finally { setBusy(false) }
  }
  return <>
    <button type="button" className="protocol-primary" onClick={() => {
      setDate(new Date().toLocaleDateString('en-CA')); setError(''); setOpen(true)
    }}>Activate</button>
    {open && <ProtocolDialog title="Activate Planned protocol" onClose={() => { if (!busy) setOpen(false) }}>
      <div className="protocol-activation">
        <h2>Activate {protocol.name || 'protocol'}</h2>
        <p>Confirm when this protocol starts. Your saved compounds and dosing setup will be kept.</p>
        <label>Start date<input aria-label="Activation start date" type="date" value={date} disabled={busy} onChange={event => setDate(event.target.value)} /></label>
        {error && <p role="alert" className="protocol-error">{error}</p>}
        <div className="protocol-action-row">
          <button type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className="protocol-primary" disabled={busy} onClick={activate}>{busy ? 'Activating…' : 'Confirm activation'}</button>
        </div>
      </div>
    </ProtocolDialog>}
  </>
}
