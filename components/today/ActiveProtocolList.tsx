import Link from 'next/link'
import type { ReactNode } from 'react'
import AppIcon from '../app/AppIcon'
import type { todayProtocols } from '../../lib/health/today'

type Props = { items: ReturnType<typeof todayProtocols>; selected: string | null; onSelect: (id: string) => void; children: ReactNode }
export default function ActiveProtocolList({ items, selected, onSelect, children }: Props) {
  return <section className="today-card" aria-labelledby="active-title">
    <div className="today-section-heading"><h2 id="active-title">Active protocols</h2><Link className="today-text-link" href="/protocol/manage">Manage <AppIcon name="chevron" size={14} /></Link></div>
    {items.length ? <>
      <div className="today-rings">{children}<p>Tap a ring or a row to explore your protocol.</p></div>
      <ul className="today-protocol-list">{items.map((item, index) => <li key={item.id}><button type="button" className="today-protocol-row" onClick={() => onSelect(item.id)} aria-expanded={selected === item.id} aria-controls="today-protocol-detail">
        <span className={`today-compound-icon today-color-${index % 5}`}><AppIcon name="protocols" /></span>
        <span className="today-protocol-copy"><strong>{item.name}</strong><span>{item.details}</span>{!item.hasPhase && <small>Review your dose phase in protocol details</small>}
          <span className="today-row-status"><i aria-hidden="true" />Active{item.week && <span> · Week {item.week}</span>}</span>
        </span>
        <span className="today-protocol-chevron"><AppIcon name="chevron" size={16} /></span>
      </button></li>)}</ul>
    </> : <p className="today-empty">Your active protocols will live here. <Link href="/protocol/manage" className="today-text-link">Add a protocol</Link> when you’re ready.</p>}
  </section>
}
