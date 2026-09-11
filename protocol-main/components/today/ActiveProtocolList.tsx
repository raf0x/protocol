import Link from 'next/link'
import type { ReactNode } from 'react'
import AppIcon from '../app/AppIcon'
import type { todayProtocols } from '../../lib/health/today'

type Props = { items: ReturnType<typeof todayProtocols>; selected: string | null; onViewDetails: () => void; detailsOpen: boolean; children: ReactNode }
export default function ActiveProtocolList({ items, selected, onViewDetails, detailsOpen, children }: Props) {
  const item = items.find(item => item.id === selected) ?? items[0]
  return <section className="today-card" aria-labelledby="active-title">
    <div className="today-section-heading"><h2 id="active-title">Active protocols</h2><Link className="today-text-link" href="/protocol/manage">Manage <AppIcon name="chevron" size={14} /></Link></div>
    {item ? <>
      <div className="today-rings">{children}<p>Tap a ring to see your protocol.</p></div>
      <div className="today-selected-protocol">
        <div className="today-protocol-copy" aria-live="polite" aria-atomic="true">
          <strong>{item.name}</strong><span>{item.details}</span>
          {!item.hasPhase && <small>Review your dose phase in protocol details</small>}
          <span className="today-row-status"><i aria-hidden="true" />Active{item.week && <span> · Week {item.week}</span>}</span>
        </div>
        <button type="button" className="today-text-link" onClick={onViewDetails} aria-expanded={detailsOpen} aria-controls="today-protocol-detail">View details <AppIcon name="chevron" size={14} /></button>
      </div>
    </> : <p className="today-empty">Your active protocols will live here. <Link href="/protocol/manage" className="today-text-link">Add a protocol</Link> when you’re ready.</p>}
  </section>
}
