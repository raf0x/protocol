import Link from 'next/link'
import ActivateProtocol from './ActivateProtocol'
import type { LibraryProtocol } from '../../lib/health/protocolPresentation'

export default function PlannedProtocols({ protocols, onActivated }: { protocols: LibraryProtocol[]; onActivated: () => void }) {
  const planned = protocols.filter(protocol => protocol.status === 'planned')
  if (!planned.length) return null
  return <section className="today-card planned-protocols" aria-label="Planned protocols">
    <h2>Planned protocols</h2>
    <p>Saved for later. Choose a start date when you activate.</p>
    {planned.map(protocol => <article key={protocol.id}>
      <div><Link href={`/protocol/manage?protocol=${encodeURIComponent(protocol.id)}`}>{protocol.name || 'Planned protocol'}</Link>
        <p>{protocol.compounds?.map(compound => compound.name).filter(Boolean).join(' · ')}</p></div>
      <ActivateProtocol protocol={protocol} onActivated={onActivated} />
    </article>)}
  </section>
}
