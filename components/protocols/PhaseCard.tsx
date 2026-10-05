'use client'

import { useState } from 'react'
import { expiredLatestPhase } from '../../lib/health/phaseLifecycle'
import { compoundOverview, phaseLabel, type LibraryCompound, type LibraryProtocol } from '../../lib/health/protocolPresentation'
import DoseSummary from './DoseSummary'
import { continueLatestPhase } from '../../lib/health/protocolMutations'
import { protocolLifecycle } from '../../lib/health/protocolDates'

export default function PhaseCard({ protocol, compound, today, onEdit, onReload }: { protocol: LibraryProtocol; compound: LibraryCompound; today: string; onEdit: (compoundId?: string, addPhase?: boolean) => void; onReload: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const info = compoundOverview(protocol, compound, today)
  const scheduled = protocolLifecycle(protocol,today) === 'scheduled'
  const expired = expiredLatestPhase(compound.phases ?? [], protocol.status || '', protocol.start_date || '', today)
  async function continueLatest() {
    if (!expired || busy) return
    setBusy(true); setError('')
    try {
      await continueLatestPhase({ protocolId: protocol.id, compoundId: compound.id, phaseId: expired.id })
      onReload()
    } catch { setError('This phase could not be continued. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="protocol-phase"><div className="protocol-phase-meta"><h3>{protocol.status === 'completed' ? 'Final phase' : scheduled ? 'Scheduled phase' : protocol.status === 'planned' ? 'Planned phase' : 'Current phase'}</h3>
    <p>{info.phase ? scheduled ? phaseLabel(info.phase).replace('Started Week','From Week') : phaseLabel(info.phase) : expired ? 'Latest phase ended' : 'No current phase saved'}</p></div>
    {expired && <div className="protocol-action-row"><button disabled={busy} onClick={continueLatest}>{busy ? 'Continuing…' : 'Continue latest phase'}</button><button onClick={() => onEdit(compound.id, true)}>Add new phase</button></div>}
    {!compound.phases?.length && protocol.status !== 'completed' && <button onClick={() => onEdit(compound.id, true)}>Add a phase</button>}
    {error && <p role="alert">{error}</p>}
    {!!compound.phases?.length && <details className="protocol-phase-history"><summary>Show phases <small>({compound.phases.length})</small></summary>{[...compound.phases].sort((a, b) => (b.start_week ?? 0) - (a.start_week ?? 0)).map(phase => <div className="protocol-history-row" key={phase.id}><DoseSummary phase={phase} compact /><span>{phaseLabel(phase)}</span></div>)}</details>}
  </section>
}
