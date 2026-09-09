import ProtocolCard from './ProtocolCard'
import type { LibraryProtocol } from '../../lib/health/protocolPresentation'

type Props = { protocols: LibraryProtocol[]; today: string; onOpen: (id: string) => void; onAdd: () => void; selecting: boolean; selected: Set<string>; onSelect: (id: string) => void }
export default function ProtocolLibrary(props: Props) {
  return <div className="protocol-library">{['Active', 'Completed'].map(section => {
    const rows = props.protocols.filter(protocol => section === 'Completed' ? protocol.status === 'completed' : protocol.status !== 'completed')
    return <section key={section} aria-label={section + ' protocols'}>
      <div className="protocol-section-title"><h2>{section}</h2><span>{rows.length}</span></div>
      {rows.length ? rows.map((protocol, index) => <ProtocolCard key={protocol.id} protocol={protocol} today={props.today} onOpen={() => props.onOpen(protocol.id)} index={index} selecting={props.selecting} selected={props.selected.has(protocol.id)} onSelect={() => props.onSelect(protocol.id)} />) : <div className="protocol-empty"><h3>{section === 'Active' ? 'Your next protocol starts here' : 'A place for your completed chapters'}</h3><p>{section === 'Active' ? 'Add what you know now. You can fill in the details later.' : 'Completed protocols keep their dates and history here.'}</p>{section === 'Active' && <button className="protocol-primary" onClick={props.onAdd}>Add Protocol</button>}</div>}
    </section>
  })}</div>
}
