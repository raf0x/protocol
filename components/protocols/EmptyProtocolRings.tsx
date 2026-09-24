import Link from 'next/link'
import ProtocolRingComposition from './ProtocolRingComposition'

export default function EmptyProtocolRings() {
  return <div className="protocol-empty-rings">
    <ProtocolRingComposition />
    <Link href="/protocol/manage?new=1" aria-label="Add your first protocol" className="protocol-empty-action">Add Protocol</Link>
    <p>Choose a compound, then set up your tracking.</p>
  </div>
}
