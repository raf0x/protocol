import AppIcon from '../app/AppIcon'
import { compoundOverview, dateLabel, durationLabel, type LibraryProtocol } from '../../lib/health/protocolPresentation'

type Props = { protocol: LibraryProtocol; today: string; onOpen: () => void; selecting: boolean; selected: boolean; onSelect: () => void; index: number }
export default function ProtocolCard({ protocol, today, onOpen, selecting, selected, onSelect, index }: Props) {
  const completed = protocol.status === 'completed'
  return <article className={`protocol-card ${completed ? 'protocol-completed' : ''}`}>
    {selecting && <label className="protocol-selection"><input type="checkbox" checked={selected} onChange={onSelect} />Select {protocol.name}</label>}
    <button type="button" className="protocol-card-button" onClick={onOpen} aria-label={`View ${protocol.name || 'protocol'}`}>
      <span className={`today-compound-icon today-color-${index % 5}`}><AppIcon name="protocols" /></span>
      <span className="protocol-card-copy"><strong>{protocol.name || 'Untitled protocol'}</strong>
        {(protocol.compounds ?? []).map(compound => {
          const info = compoundOverview(protocol, compound, today)
          return <span className="protocol-compound-summary" key={compound.id}>
            {(protocol.compounds?.length ?? 0) > 1 && <b>{compound.name}</b>}
            <span>{info.dose}{info.phase && ` · ${info.frequency}`}</span>
            <small>{info.week && `Week ${info.week} · `}{info.phase?.route && `${info.phase.route} · `}{completed ? 'Completed' : protocol.status || 'Active'}</small>
            {info.next && <small>Scheduled {info.next.date === today ? 'today' : dateLabel(info.next.date)}{info.next.time ? ` · ${info.next.time}` : ''}</small>}
          </span>
        })}
        {!protocol.compounds?.length && <span>Dose not fully calculated</span>}
        {completed && <small>{dateLabel(protocol.start_date)}{protocol.completed_date && ` – ${dateLabel(protocol.completed_date)}`}{durationLabel(protocol) && ` · ${durationLabel(protocol)}`}</small>}
      </span><AppIcon name="chevron" size={17} />
    </button>
  </article>
}
