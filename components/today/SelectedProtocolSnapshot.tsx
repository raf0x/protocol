import type { CSSProperties, ReactNode } from 'react'

export type SnapshotFact = { label: string; value: ReactNode }

/** Display the existing HeroProtocolCard results; no dosing or inventory calculations here. */
export default function SelectedProtocolSnapshot({ name, protocolName, medication, medicationKnown, frequency, week, started, color, facts, visual, notice, actions, lifecycle }: {
  name: string; protocolName: string; medication: string; frequency?: string | null
  medicationKnown: boolean; week: number; started: string; color: string
  facts: SnapshotFact[]; visual: ReactNode; notice?: ReactNode; actions?: ReactNode; lifecycle?: ReactNode
}) {
  return <section className="today-protocol-snapshot" aria-labelledby="selected-protocol-name" style={{ '--compound-color': color } as CSSProperties}>
    <div className="today-snapshot-heading">
      <span>ACTIVE COMPOUND</span>
      <h3 id="selected-protocol-name">{name}</h3>
      {protocolName && protocolName !== name && <p className="today-snapshot-plan">{protocolName}</p>}
      <p className="today-snapshot-period"><span className="today-snapshot-week">Week {week}</span><span>Started {started || 'Not recorded'}</span></p>
      <p className="today-snapshot-medication"><strong data-known={medicationKnown}>{medication}{medicationKnown && '/dose'}</strong>{frequency && <span>{frequency}</span>}</p>
      {notice && <div className="today-snapshot-notice">{notice}</div>}
    </div>
    <div className="today-snapshot-vial-rail">
      <div className="today-snapshot-vial">{visual}</div>
      {lifecycle && <div className="today-snapshot-lifecycle">{lifecycle}</div>}
    </div>
    <dl className="today-snapshot-facts">
      {facts.map(fact => <div className="today-snapshot-fact" key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
    </dl>
    <details className="today-snapshot-more"><summary>More protocol details</summary><p>Saved preparation facts do not confirm the current physical vial.</p>    <dl className="today-snapshot-facts">
      {facts.map(fact => <div className="today-snapshot-fact" key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
    </dl></details>
    {actions && <div className="today-snapshot-actions">{actions}</div>}
  </section>
}
