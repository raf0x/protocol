import type { CSSProperties } from 'react'
import { ringColors, ringPositions } from '../../lib/protocols/rings'
import ProtocolRing, { type RingItem } from './ProtocolRing'

export default function ProtocolRingComposition({ items = [], selected, onSelect, celebrate = false }: {
  items?: RingItem[]; selected?: string | null; onSelect?: (id: string) => void; celebrate?: boolean
}) {
  const positions = items.length
    ? items.map((_, index) => {
      const row = Math.floor(index / 3)
      const indexInRow = index % 3
      const rowSize = Math.min(3, items.length - row * 3)
      const column = rowSize === 1 ? 2 : rowSize === 2 ? 1 + indexInRow * 2 : indexInRow * 2
      return [column, row] as const
    })
    : ringPositions
  return <div className={`protocol-ring-composition${celebrate ? ' protocol-ring-success' : ''}`} role="group" aria-label={items.length ? 'Your protocols' : 'Decorative protocol rings'}>
    {positions.map(([column, row], index) => {
      const item = items[index]
      const style = { '--ring-color': ringColors[index % ringColors.length], gridColumn: `${column + 1} / span 2`, gridRow: row + 1 } as CSSProperties
      if (!item) return <span key={index} className="protocol-ring protocol-ring-empty" style={style} aria-hidden="true" />
      return <ProtocolRing key={item.id} item={item} style={style} selected={selected === item.id} onSelect={onSelect} />
    })}
  </div>
}
