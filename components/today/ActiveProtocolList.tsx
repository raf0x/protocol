import Link from 'next/link'
import type { ReactNode } from 'react'
import AppIcon from '../app/AppIcon'
import EmptyProtocolRings from '../protocols/EmptyProtocolRings'
import type { todayProtocols } from '../../lib/health/today'

type Props = { items: ReturnType<typeof todayProtocols>; selected: string | null; detail: ReactNode; children: ReactNode }
export default function ActiveProtocolList({ items, selected, detail, children }: Props) {
  const item = items.find(item => item.id === selected) ?? items[0]
  return <section className="today-card" aria-labelledby="active-title">
    <div className="today-section-heading"><h2 id="active-title">Active protocols</h2><Link className="today-text-link" href="/protocol/manage">Manage <AppIcon name="chevron" size={14} /></Link></div>
    {item ? <>
      <div className="today-rings">{children}<p>Tap a ring to see your protocol.</p></div>
      <div className="today-merged-detail">{detail}</div>
    </> : <EmptyProtocolRings />}
  </section>
}
