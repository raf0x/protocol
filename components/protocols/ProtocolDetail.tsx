'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { administrationForPhase } from '../../lib/health/dosingEntry'
import { normalizeTimeline, type ProtocolEventRow } from '../../lib/health/timeline'
import { compoundOverview, dateLabel, type LibraryProtocol } from '../../lib/health/protocolPresentation'
import PhaseCard from './PhaseCard'

type Log = { id: string; compound_id: string; date: string; taken: boolean }
type Props = { protocol: LibraryProtocol; today: string; onBack: () => void; onEdit: (compoundId?: string, addPhase?: boolean) => void; onComplete: () => void; onReactivate: () => void; onDelete: () => void; onReload: () => void }
export default function ProtocolDetail(props: Props) {
  const { protocol, today } = props
  const [history, setHistory] = useState<ProtocolEventRow[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [historyState, setHistoryState] = useState('loading')
  useEffect(() => {
    let live = true
    const client = createClient()
    async function loadHistory() {
      try {
        const ids = (protocol.compounds ?? []).map(compound => compound.id)
        const [events, injections] = await Promise.all([
          client.from('protocol_events').select('*').eq('protocol_id', protocol.id).order('date', { ascending: false }).limit(50),
          ids.length ? client.from('injection_logs').select('id,compound_id,date,taken').in('compound_id', ids).eq('taken', true).order('date', { ascending: false }).limit(50) : Promise.resolve({ data: [], error: null }),
        ])
        if (events.error || injections.error) throw new Error('History unavailable')
        if (live) { setHistory(events.data ?? []); setLogs(injections.data ?? []); setHistoryState('ready') }
      } catch { if (live) setHistoryState('error') }
    }
    void loadHistory()
    return () => { live = false }
  }, [protocol])
  const events = normalizeTimeline(history.map(event => ({ ...event, protocols: protocol, compounds: protocol.compounds?.find(compound => compound.id === event.compound_id) ?? null })), [])
  return <div className="protocol-detail">
    <button className="protocol-back" onClick={props.onBack}>‹ All protocols</button>
    <header className="protocol-detail-header"><span className="protocol-status">{protocol.status || 'Active'}</span><h1>{protocol.name}</h1><p>Started {dateLabel(protocol.start_date)}{protocol.completed_date && ` · Completed ${dateLabel(protocol.completed_date)}`}</p><button className="protocol-primary" onClick={() => props.onEdit()}>Edit protocol</button></header>
    {!protocol.compounds?.length && <div className="protocol-empty">No compounds saved yet. Add the details you know in the editor.</div>}
    {(protocol.compounds ?? []).map(compound => {
      const info = compoundOverview(protocol, compound, today)
      const admin = administrationForPhase(info.phase)
      const entry = info.phase?.dosing_entry
      const preparation = entry ?? compound
      const scale = entry?.syringe_scale || info.phase?.syringe_scale
      const lastLog = logs.find(log => log.compound_id === compound.id)
      return <section className="protocol-detail-compound" key={compound.id}>
        <h2>{compound.name}</h2>
        <div className="protocol-dose-overview"><span>{protocol.status === 'completed' ? 'Dose at completion' : 'Current dose'}</span><strong>{info.dose}</strong><p>{info.frequency}{info.phase?.route && ` · ${info.phase.route}`}{info.week && ` · Week ${info.week}`}</p></div>
        <section className="protocol-phase"><h3>Schedule</h3><p>{info.frequency}{info.phase?.time_of_day && ` · ${info.phase.time_of_day}`}</p>
          {!!info.phase?.days_of_week?.length && <p>{info.phase.days_of_week.map(day => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(' · ')}</p>}
          {info.next && <p>Scheduled {info.next.date === today ? 'today' : dateLabel(info.next.date)}{info.next.time && ` · ${info.next.time}`}</p>}
          {lastLog && <p>Last logged dose: {dateLabel(lastLog.date)}</p>}
        </section>
        <PhaseCard protocol={protocol} compound={compound} today={today} onEdit={props.onEdit} onReload={props.onReload} />
        <details className="protocol-advanced"><summary>Administration details</summary><dl>
          {info.phase?.route && <><dt>Route</dt><dd>{info.phase.route}</dd></>}
          {admin.volume != null && <><dt>Injection volume</dt><dd>{admin.volume} mL</dd></>}
          {admin.markings != null && <><dt>Syringe markings</dt><dd>{admin.markings} {scale ? `units on U-${scale}` : 'units, scale not recorded'}</dd></>}
        </dl>{!info.phase?.route && admin.volume == null && admin.markings == null && <p>Administration details can be added later.</p>}</details>
        <details className="protocol-advanced"><summary>Reconstitution & concentration</summary><dl>
          {(entry?.vial_label) && <><dt>Vial label</dt><dd>{entry.vial_label}</dd></>}
          {preparation.vial_strength != null && preparation.vial_strength !== '' && <><dt>Vial amount</dt><dd>{preparation.vial_strength} {preparation.vial_unit}</dd></>}
          {preparation.bac_water_ml != null && preparation.bac_water_ml !== '' && <><dt>Liquid added</dt><dd>{preparation.bac_water_ml} mL</dd></>}
          {preparation.concentration_value != null && preparation.concentration_value !== '' && <><dt>Labelled concentration</dt><dd>{preparation.concentration_value} {preparation.concentration_unit}</dd></>}
          {compound.reconstitution_date && <><dt>Reconstituted</dt><dd>{dateLabel(compound.reconstitution_date)}</dd></>}
        </dl><p>These are saved preparation details. Edit to add or review them.</p></details>
        <details className="protocol-advanced"><summary>Inventory & notes</summary><p>{compound.vials_in_stock != null ? `${compound.vials_in_stock} vials in stock` : 'Inventory not recorded'}</p><p className="protocol-notes">{compound.notes || 'No notes yet.'}</p></details>
      </section>
    })}
    <details className="protocol-advanced"><summary>History</summary>
      {historyState !== 'ready' ? <p role="status">{historyState === 'loading' ? 'Loading history…' : 'History could not be loaded. Reopen this protocol to retry.'}</p> : <>
        <h3>Recent changes</h3>{events.length ? events.map(event => <div className="protocol-history-row" key={event.id}><strong>{event.title}</strong>{event.description && <p>{event.description}</p>}<time>{dateLabel(event.date)}</time></div>) : <p>No protocol changes recorded yet.</p>}
        <h3>Recent logged doses</h3>{logs.length ? logs.map(log => <div className="protocol-history-row" key={log.id}><strong>{protocol.compounds?.find(compound => compound.id === log.compound_id)?.name || 'Dose logged'}</strong><time>{dateLabel(log.date)}</time></div>) : <p>No doses logged yet.</p>}
        <p>Showing up to 50 recent entries of each type. Older records remain unchanged.</p>
      </>}
    </details>
    <details className="protocol-advanced"><summary>Protocol actions</summary><div className="protocol-action-row">
      <button onClick={protocol.status === 'completed' ? props.onReactivate : props.onComplete}>{protocol.status === 'completed' ? 'Reactivate protocol' : 'Complete protocol'}</button>
      <button className="protocol-danger" onClick={props.onDelete}>Delete protocol</button>
    </div></details>
  </div>
}
