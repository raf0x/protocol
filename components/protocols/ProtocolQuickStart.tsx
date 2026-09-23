'use client'
import type { ReactNode } from 'react'
import AppIcon from '../app/AppIcon'
import CompoundPicker from './CompoundPicker'
import QuickProtocolFields, { QuickAdditionalFields } from './QuickProtocolFields'
import { QuickStartError } from './QuickStartControls'
import ProtocolStartDate from './ProtocolStartDate'
import { newCompound, type QuickStartDraft } from '../../lib/protocols/form'
import { quickStartIssue, setupSummary, type QuickStartIssue } from '../../lib/protocols/quickStart'
import { localCalendarDate } from '../../lib/health/protocolDates'

export function QuickStartReview({ value, today = localCalendarDate() }: { value: QuickStartDraft; today?: string }) {
  if (quickStartIssue(value)) return null
  return <section className="quick-review" aria-label="Review protocol">
    {value.compounds.map((c, i) => <div key={i}><strong>{c.name}</strong><p>{setupSummary(c)}</p>
      <p>{value.startDate === today ? 'Starts today' : value.startDate ? `Starts ${new Date(`${value.startDate}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : 'Start date not chosen'} · {c.duration_weeks ? `${c.duration_weeks} weeks` : 'Ongoing'}</p>
    </div>)}
  </section>
}

export default function ProtocolQuickStart({ value, onChange, today, issue, children, actions, saveError }: {
  value: QuickStartDraft; onChange: (value: QuickStartDraft) => void; today: string; issue?: QuickStartIssue | null; children?: ReactNode; actions?: ReactNode; saveError?: string
}) {
  const update = (index: number, compound: QuickStartDraft['compounds'][number]) => onChange({ ...value, compounds: value.compounds.map((c, i) => i === index ? compound : c) })
  const first = value.compounds[0]
  const pendingIssue = quickStartIssue(value)
  const ready = !pendingIssue
  // A supplied medication amount needs its unit immediately; other empty fields
  // wait for a save attempt so the initial form is not a wall of errors.
  const visibleIssue = issue || (pendingIssue?.field === 'dose_unit' ? pendingIssue : null)
  const compoundFields = (index: number) => <QuickProtocolFields key={`${index}:${value.compounds[index].name}`} idPrefix={`quick-${index}`} value={value.compounds[index]} onChange={next => update(index, next)} issue={visibleIssue?.index === index ? visibleIssue : null} />
  const additionalFields = (index: number) => <QuickAdditionalFields idPrefix={`quick-${index}`} value={value.compounds[index]} today={today} onChange={next => update(index, next)} issue={issue?.index === index ? issue : null} />
  return <div className={`protocol-creation-layout${ready ? ' quick-has-review' : ''}`}>
    <div className="protocol-quick-start">
      <CompoundPicker idPrefix="quick-0" value={first} onChange={next => update(0, next)} />
      <QuickStartError issue={issue?.field === 'name' && issue.index === 0 ? issue : null} />
      {first.name.trim() && <>
        <ProtocolStartDate value={value.startDate} today={today} onChange={startDate => onChange({ ...value, startDate })} issue={issue?.field === 'startDate' ? issue : null} />
        {compoundFields(0)}
        <details className="quick-additional">
          <summary><AppIcon name="chevron" size={16} /><span>Add preparation, inventory or notes</span>{value.compounds.length === 1 && <small>Optional</small>}</summary>
          {additionalFields(0)}
          {value.compounds.slice(1).map((c, offset) => { const i = offset + 1; return <section className="quick-extra-compound" key={i} aria-label={`Additional compound ${i + 1}`}>
            <CompoundPicker idPrefix={`quick-${i}`} value={c} onChange={next => update(i, next)} />
            <QuickStartError issue={issue?.field === 'name' && issue.index === i ? issue : null} />
            {c.name.trim() && <>{compoundFields(i)}{additionalFields(i)}</>}
            <button className="quick-text-action" type="button" onClick={() => onChange({ ...value, compounds: value.compounds.filter((_, index) => index !== i) })}>Remove compound {i + 1}</button>
          </section> })}
          <button className="quick-text-action" type="button" onClick={() => onChange({ ...value, compounds: [...value.compounds, newCompound()] })}>Add another compound</button>
          {children}
        </details>
      </>}
    </div>
    {first.name.trim() && (ready || actions || saveError) && <aside className="quick-summary" aria-label="Protocol summary and actions">
      <QuickStartReview value={value} today={today} />
      <QuickStartError message={saveError} />
      {actions}
    </aside>}
  </div>
}
