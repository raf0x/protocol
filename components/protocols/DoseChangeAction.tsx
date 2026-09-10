'use client'

import { useState } from 'react'
import { changeProtocolDose } from '../../lib/health/protocolMutations'
import { dosingDisplay, type DosingEntry } from '../../lib/health/dosingEntry'
import type { LibraryCompound, LibraryProtocol } from '../../lib/health/protocolPresentation'
import { compoundOverview } from '../../lib/health/protocolPresentation'

function editableMedication(phase: ReturnType<typeof compoundOverview>['phase']) {
  if (!phase) return null
  if (phase.dosing_entry) {
    const entry = phase.dosing_entry
    const display = dosingDisplay(phase)
    if (entry.mode !== 'medication' || entry.review_status !== 'confirmed' || !display.medication) return null
    return { value: String(display.medication.value), unit: display.medication.unit, entry }
  }
  if (phase.dose_semantics_version !== 1 || phase.dose == null || !['mg', 'mcg', 'IU'].includes(phase.dose_unit ?? '')) return null
  const entry: DosingEntry = {
    version: 2, mode: 'medication', review_status: 'confirmed', dose: String(phase.dose), dose_unit: phase.dose_unit!,
    syringe_markings: '', syringe_scale: phase.syringe_scale == null ? '' : String(phase.syringe_scale),
    injection_volume: phase.injection_volume_ml == null ? '' : String(phase.injection_volume_ml), vial_strength: '',
    vial_unit: '', bac_water_ml: '', concentration_value: '', concentration_unit: '', vial_label: '',
  }
  return { value: String(phase.dose), unit: phase.dose_unit!, entry }
}

export default function DoseChangeAction({ protocol, compound, today, onSaved }: {
  protocol: LibraryProtocol; compound: LibraryCompound; today: string; onSaved: () => void
}) {
  const phase = compoundOverview(protocol, compound, today).phase
  const current = editableMedication(phase)
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(current?.value ?? '')
  const [effectiveDate, setEffectiveDate] = useState(today)
  const [earlier, setEarlier] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (protocol.status !== 'active' || !current) return null

  async function save() {
    const number = Number(value)
    if (!value.trim() || !Number.isFinite(number) || number < 0) { setError('Enter a valid non-negative dose.'); return }
    setBusy(true); setError('')
    try {
      await changeProtocolDose({
        protocolId: protocol.id, compoundId: compound.id, effectiveDate: earlier ? effectiveDate : today,
        dosingEntry: { ...current!.entry, mode: 'medication', review_status: 'confirmed', dose: value.trim(), dose_unit: current!.unit },
      })
      setOpen(false); onSaved()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save the dose change.') }
    finally { setBusy(false) }
  }

  return <details className="protocol-dose-change" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Change dose</summary>
    <div className="protocol-dose-change-body">
      <p>Current dose <strong>{current.value} {current.unit}</strong></p>
      <label>New medication dose<div className="protocol-dose-input"><input type="number" min="0" step="any" value={value} onChange={event => setValue(event.target.value)} /><span>{current.unit}</span></div></label>
      <label className="protocol-check"><input type="checkbox" checked={earlier} onChange={event => setEarlier(event.target.checked)} /> Change happened earlier</label>
      {earlier && <label>Effective date<input type="date" min={protocol.start_date ?? undefined} max={today} value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} /></label>}
      <p className="protocol-guidance">Frequency, route, preparation, and administration details stay unchanged.</p>
      {error && <p role="alert" className="protocol-error">{error}</p>}
      <div className="protocol-action-row"><button type="button" onClick={() => setOpen(false)}>Cancel</button><button type="button" className="protocol-primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save dose change'}</button></div>
    </div>
  </details>
}
