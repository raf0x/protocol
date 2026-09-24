'use client'
import Link from 'next/link'
import ProtocolRingComposition from '../protocols/ProtocolRingComposition'
import { activeRingItems } from '../../lib/protocols/rings'
import { useLocalCalendarDate } from '../../lib/health/useLocalCalendarDate'
import type { ProtocolRow } from '../../lib/health/timeline'

type Props = {
  activeProtocols: ProtocolRow[]
  activeCompoundTab: string | null
  setActiveCompoundTab: (id: string) => void
}
export default function CompoundRings({ activeProtocols, activeCompoundTab, setActiveCompoundTab }: Props) {
  const today = useLocalCalendarDate()
  const items = activeRingItems(activeProtocols, today)
  return <div className="protocol-rings-hero">
    <ProtocolRingComposition items={items.slice(0, 5)} selected={activeCompoundTab || items[0]?.id} onSelect={setActiveCompoundTab} />
    <div className="protocol-ring-links">
      <Link className="today-text-link" href="/protocol/manage?new=1">{items.length ? 'Add another protocol' : 'Add Protocol'}</Link>
      {items.length > 5 && <Link className="today-text-link" href="/protocol/manage" aria-label={`View all protocols, ${items.length - 5} more`}>+{items.length - 5} more</Link>}
    </div>
  </div>
}
