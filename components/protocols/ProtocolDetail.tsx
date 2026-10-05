'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../lib/supabase'
import { administrationDisplay, formatProtocolAmount } from '../../lib/health/dosingEntry'
import { normalizeTimeline, type ProtocolEventRow } from '../../lib/health/timeline'
import { compoundOverview, dateLabel, type LibraryProtocol } from '../../lib/health/protocolPresentation'
import ActivateProtocol from './ActivateProtocol'
import { protocolLifecycle } from '../../lib/health/protocolDates'
import PhaseCard from './PhaseCard'
import DoseChangeAction from './DoseChangeAction'
import DoseSummary, { dosingIssue } from './DoseSummary'

type Log = { id: string; compound_id: string; date: string; taken: boolean }
type Props = { protocol: LibraryProtocol; today: string; onBack: () => void; onEdit: (compoundId?: string, addPhase?: boolean) => void; onComplete: () => void; onPause: () => void; onResume: () => void; onReactivate: () => void; onDelete: () => void; onReload: () => void }
export default function ProtocolDetail(props: Props) {
  const { protocol, today } = props
  const scheduled = protocolLifecycle(protocol,today) === 'scheduled'
  const [history, setHistory] = useState<ProtocolEventRow[]>([])
  const [logs, setLogs] = useState<Log[]>([])
  const [historyState, setHistoryState] = useState('loading')
  const [showAllHistory, setShowAllHistory] = useState(false)
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
  const events = normalizeTimeline(history.filter(event => event.date <= today).map(event => ({ ...event, protocols: protocol, compounds: protocol.compounds?.find(compound => compound.id === event.compound_id) ?? null })), [])
  return <div className="protocol-detail protocol-detail-v2">
    <button className="protocol-back" onClick={props.onBack}>‹ All protocols</button>
    <header className="protocol-detail-header"><div className="protocol-detail-topline"><span className="protocol-status">{scheduled ? 'Scheduled' : protocol.status === 'planned' ? 'Planned' : protocol.status || 'Active'}</span><button type="button" className="protocol-detail-edit" onClick={() => props.onEdit()}>Edit protocol</button></div>{(protocol.compounds?.length !== 1 || protocol.compounds[0].name !== protocol.name) && <h1>{protocol.name}</h1>}{protocol.status === 'planned' && <ActivateProtocol protocol={protocol} onActivated={props.onReload} />}</header>
    {!protocol.compounds?.length && <div className="protocol-empty">No compounds saved yet. Add the details you know in the editor.</div>}
    {(protocol.compounds ?? []).map(compound => {
      const info = compoundOverview(protocol, compound, today)
      const admin = administrationDisplay(info.phase)
      const entry = info.phase?.dosing_entry
      const issue = entry ? (() => { try { return dosingIssue(entry) } catch { return { title: 'Dose details need review', explanation: 'Check the entered amounts and units.', action: 'Review dose' } } })() : null
      return <section className="protocol-detail-compound" key={compound.id}>
        {protocol.compounds?.length === 1 ? <h1>{compound.name}</h1> : <h2>{compound.name}</h2>}
        <div className="protocol-dose-overview"><DoseSummary phase={info.phase} compact showIssue={false} /><p>{info.frequency}{info.phase?.route && ` · ${info.phase.route}`}</p></div>
        <div className="protocol-primary-facts">
          {info.next && <div className="protocol-next-dose"><span>Next dose</span><strong>{info.next.date === today ? 'Today' : dateLabel(info.next.date)}</strong>{info.next.time && <small>{info.next.time}</small>}</div>}
          {(admin.syringe || admin.volume) && <div className="protocol-compact-administration"><span>Dose details</span><p>{[admin.syringe?.replace(/ U-(100|40) units$/, ' units'), admin.volume].filter(Boolean).join(' · ')}</p></div>}
        </div>
        {issue && <div className="protocol-dose-issue" role="status"><strong>{issue.title}</strong><p>{issue.explanation}</p><button type="button" onClick={() => props.onEdit(compound.id)}>{issue.action}</button></div>}
      </section>
    })}
    <details className="protocol-more-details"><summary>More details</summary>
      {(protocol.compounds ?? []).map(compound => {
        const info = compoundOverview(protocol, compound, today)
        const admin = administrationDisplay(info.phase)
        const entry = info.phase?.dosing_entry
        const preparation = entry ?? compound
        const vialAmount = formatProtocolAmount(preparation.vial_strength, preparation.vial_unit)
        const liquid = formatProtocolAmount(preparation.bac_water_ml, 'mL', 'volume')
        const concentration = formatProtocolAmount(preparation.concentration_value, preparation.concentration_unit)
        const stock = formatProtocolAmount(compound.vials_in_stock, 'vials in stock', 'count')
        return <div className="protocol-more-compound" key={compound.id}>
        {protocol.compounds?.length !== 1 && <h2>{compound.name}</h2>}
        <div className="protocol-more-grid">
        <section className="protocol-more-section"><h3>Administration</h3><dl>
          {info.phase?.route && <><dt>Route</dt><dd>{info.phase.route}</dd></>}
          {admin.volume && <><dt>Injection volume</dt><dd>{admin.volume}</dd></>}
          {admin.syringe && <><dt>Syringe draw</dt><dd>{admin.syringe}</dd></>}
        </dl>{!info.phase?.route && !admin.volume && !admin.syringe && <p>Not recorded</p>}</section>
        <section className="protocol-more-section"><h3>Vial</h3><dl>
          {vialAmount && <><dt>Vial amount</dt><dd>{vialAmount}</dd></>}
          {liquid && <><dt>Liquid added</dt><dd>{liquid}</dd></>}
          {concentration && <><dt>Concentration</dt><dd>{concentration}</dd></>}
        </dl>{!vialAmount && !liquid && !concentration && <p>Not recorded</p>}</section>
        <section className="protocol-more-section protocol-plan"><h3>Plan</h3><dl>
          {(!!info.phase?.days_of_week?.length || info.phase?.time_of_day) && <><dt>Schedule</dt><dd>{[info.phase.days_of_week?.map(day => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(' · '), info.phase.time_of_day].filter(Boolean).join(' · ')}</dd></>}
          <dt>Inventory</dt><dd>{stock ?? 'Not recorded'}</dd>
          {compound.notes && <><dt>Notes</dt><dd className="protocol-notes">{compound.notes}</dd></>}
        </dl>
        <PhaseCard protocol={protocol} compound={compound} today={today} onEdit={props.onEdit} onReload={props.onReload} />
        </section>
        </div>
        {!scheduled && <DoseChangeAction protocol={protocol} compound={compound} today={today} onSaved={props.onReload} />}
        </div>
      })}
      <details className="protocol-history-disclosure"><summary aria-label="History: show recent changes">Show history</summary>
      {historyState !== 'ready' ? <p role="status">{historyState === 'loading' ? 'Loading history…' : 'History could not be loaded. Reopen this protocol to retry.'}</p> : <>
        <h3>Recent changes</h3>{events.length ? events.slice(0, showAllHistory ? 50 : 5).map(event => <div className="protocol-history-row" key={event.id}><strong>{event.title}</strong>{event.description && <p>{event.description}</p>}<time>{dateLabel(event.date)}</time></div>) : <p>No protocol changes recorded yet.</p>}
        <h3>Recent logged doses</h3>{logs.length ? logs.slice(0, showAllHistory ? 50 : 5).map(log => <div className="protocol-history-row" key={log.id}><strong>{protocol.compounds?.find(compound => compound.id === log.compound_id)?.name || 'Dose logged'}</strong><time>{dateLabel(log.date)}</time></div>) : <p>No doses logged yet.</p>}
        {!showAllHistory && (events.length > 5 || logs.length > 5) && <button type="button" className="protocol-history-more" onClick={() => setShowAllHistory(true)}>Show more history</button>}
        <p>Showing up to {showAllHistory ? '50' : '5'} recent entries of each type. Older records remain unchanged.</p>
      </>}
      </details>
    </details>
    <details className="protocol-advanced"><summary>Protocol actions</summary><div className="protocol-action-row">
      {scheduled && <p>Scheduled to begin {dateLabel(protocol.start_date)}.</p>}
      {protocol.status === 'active' && !scheduled && <button onClick={props.onPause}>Pause protocol</button>}
      {protocol.status === 'paused' && <button onClick={props.onResume}>Resume protocol</button>}
      {protocol.status !== 'planned' && !scheduled && <button onClick={protocol.status === 'completed' ? props.onReactivate : props.onComplete}>{protocol.status === 'completed' ? 'Reactivate protocol' : 'Complete protocol'}</button>}
      <button className="protocol-danger" onClick={props.onDelete}>Delete protocol</button>
    </div></details>
  </div>
}
