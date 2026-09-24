import type { CSSProperties } from 'react'
import { ringColors, ringPositions } from '../../lib/protocols/rings'

type RingItem = { id: string; name: string; week: number | null; label?: string }
export default function ProtocolRingComposition({ items = [], selected, onSelect, celebrate = false }: {
  items?: RingItem[]; selected?: string | null; onSelect?: (id: string) => void; celebrate?: boolean
}) {
  return <div className={`protocol-ring-composition${celebrate ? ' protocol-ring-success' : ''}`} role="group" aria-label={items.length ? 'Your protocols' : 'Decorative protocol rings'}>
    {ringPositions.map(([column, row], index) => {
      const item = items[index]
      const style = { '--ring-color': ringColors[index], gridColumn: `${column + 1} / span 2`, gridRow: row + 1 } as CSSProperties
      if (!item) return <span key={index} className="protocol-ring protocol-ring-empty" style={style} aria-hidden="true" />
      const content = <><span className="protocol-ring-name">{item.name}</span><span className="protocol-ring-week">{item.label || (item.week === null ? 'Active' : `Wk ${item.week}`)}</span></>
      return onSelect ? <button key={item.id} type="button" className="protocol-ring protocol-ring-named" style={style} aria-pressed={selected === item.id} aria-label={`${item.name}, ${item.week === null ? 'active' : `week ${item.week}`}. Select protocol`} onClick={() => onSelect(item.id)}>{content}</button>
        : <div key={item.id} className="protocol-ring protocol-ring-named" style={style}>{content}</div>
    })}
  </div>
}
