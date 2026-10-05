import ActivateProtocol from './ActivateProtocol'
import { protocolLifecycle } from '../../lib/health/protocolDates'
import AppIcon from '../app/AppIcon'
import DoseSummary from './DoseSummary'
import { compoundOverview, dateLabel, type LibraryProtocol } from '../../lib/health/protocolPresentation'

type Props = { protocol: LibraryProtocol; today: string; onOpen: () => void; selecting: boolean; selected: boolean; onSelect: () => void; index: number; onReload?: () => void }
export default function ProtocolCard({ protocol, today, onOpen, selecting, selected, onSelect, index, onReload }: Props) {
  const completed = protocol.status === 'completed'
  const scheduled = protocolLifecycle(protocol,today) === 'scheduled'
  return <article className={`protocol-card ${completed ? 'protocol-completed' : ''}`}>
    {selecting && <label className="protocol-selection"><input type="checkbox" checked={selected} onChange={onSelect} />Select {protocol.name}</label>}
    <button type="button" className="protocol-card-button" onClick={onOpen} aria-label={`View ${protocol.name || 'protocol'}`}>
      <span className={`today-compound-icon today-color-${index % 5}`}><AppIcon name="protocols" /></span>
      <span className="protocol-card-copy"><strong>{protocol.name || 'Untitled protocol'}</strong>
        {(protocol.compounds ?? []).map(compound => {
          const info = compoundOverview(protocol, compound, today)
          return <span className="protocol-compound-summary" key={compound.id}>
            {(protocol.compounds?.length ?? 0) > 1 && <b>{compound.name}</b>}
            <DoseSummary phase={info.phase} compact />
            {info.phase && <small>{info.frequency}{info.phase.route && ` · ${info.phase.route}`}</small>}
            <small>{completed ? `Completed${protocol.completed_date ? ` ${dateLabel(protocol.completed_date)}` : ''}` : scheduled ? `Scheduled · Starts ${dateLabel(protocol.start_date)}` : protocol.status === 'planned' ? 'Planned' : protocol.status || 'Active'}{info.week && ` · Week ${info.week}`}{info.next && ` · Next ${info.next.date === today ? 'today' : dateLabel(info.next.date)}`}{info.next?.time && ` ${info.next.time}`}</small>
          </span>
        })}
        {!protocol.compounds?.length && <span>Dose not fully calculated</span>}
      </span><AppIcon name="chevron" size={17} />
    </button>
    {protocol.status === 'planned' && onReload && <div className="protocol-action-row"><ActivateProtocol protocol={protocol} onActivated={onReload} /></div>}
  </article>
}
