import type { CSSProperties } from 'react'

export type RingItem = { id: string; name: string; week: number | null; label?: string }

export default function ProtocolRing({ item, style, selected, onSelect }: {
  item: RingItem; style: CSSProperties; selected: boolean; onSelect?: (id: string) => void
}) {
  const content = <><span className="protocol-ring-name">{item.name}</span><span className="protocol-ring-week">{item.label || (item.week === null ? 'Active' : `Wk ${item.week}`)}</span></>
  return onSelect ? <button type="button" className="protocol-ring protocol-ring-named" style={style} aria-pressed={selected} aria-label={`${item.name}, ${item.week === null ? 'active' : `week ${item.week}`}. Select protocol`} title={item.name} onClick={() => onSelect(item.id)}>{content}</button>
    : <div className="protocol-ring protocol-ring-named" style={style}>{content}</div>
}
