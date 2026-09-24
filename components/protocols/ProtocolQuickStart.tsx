'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import AppIcon from '../app/AppIcon'
import CompoundPicker from './CompoundPicker'
import QuickProtocolFields, { QuickAdditionalFields } from './QuickProtocolFields'
import { QuickStartError } from './QuickStartControls'
import ProtocolStartDate from './ProtocolStartDate'
import { newCompound, type QuickStartDraft } from '../../lib/protocols/form'
import { quickStartIssue, setupSummary, type QuickStartIssue } from '../../lib/protocols/quickStart'
import { guidedSteps, guidedStepIssue, issueStep, stepTitle } from '../../lib/protocols/guidedSteps'
import { localCalendarDate, protocolLifecycle } from '../../lib/health/protocolDates'
import { dateLabel } from '../../lib/health/protocolPresentation'
import { useSetupViewport } from '../../lib/protocols/useSetupViewport'

export function QuickStartReview({ value, today = localCalendarDate() }: { value: QuickStartDraft; today?: string }) {
  if (quickStartIssue(value)) return null
  const lifecycle = protocolLifecycle({ status: value.startDate ? 'active' : 'planned', start_date: value.startDate }, today)
  return <section className="quick-review" aria-label="Review protocol">
    {value.compounds.map((c, i) => <div key={i}><strong>{c.name}</strong><p>{setupSummary(c)}{c.time_of_day ? ` · ${c.time_of_day}` : ''}</p>
      <p>{lifecycle === 'planned' ? 'Planned · Add a start date before Today scheduling begins' : lifecycle === 'scheduled' ? `Scheduled · Starts ${dateLabel(value.startDate)}` : value.startDate === today ? 'Active · Starts today' : `Active · Started ${dateLabel(value.startDate)}`} · {c.duration_weeks ? `${c.duration_weeks} weeks` : 'No end date recorded'}</p>
    </div>)}
  </section>
}

export default function ProtocolQuickStart({ value, onChange, today, children, onSave, onClose, saving = false, saveError, firstProtocol = false, retryBlocked = false }: {
  value: QuickStartDraft; onChange: (value: QuickStartDraft) => void; today: string; children?: ReactNode
  onSave: () => void; onClose: () => void; saving?: boolean; saveError?: string; firstProtocol?: boolean; retryBlocked?: boolean
}) {
  const [step, setStep] = useState(0)
  const [index, setIndex] = useState(0)
  const [attempted, setAttempted] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorRef = useSetupViewport()
  const c = value.compounds[index]
  const review = step === guidedSteps.length
  const currentStep = guidedSteps[Math.min(step, guidedSteps.length - 1)]
  const pendingIssue = review ? quickStartIssue(value) : guidedStepIssue(value, currentStep, index)
  const visibleIssue: QuickStartIssue | null = attempted || (pendingIssue?.field === 'dose_unit' && Boolean(c.dose)) ? pendingIssue : null
  const update = (compound: typeof c) => onChange({ ...value, compounds: value.compounds.map((item, i) => i === index ? compound : item) })
  useEffect(() => { heading.current?.focus(); heading.current?.scrollIntoView({ block: 'start' }) }, [step, index])
  useEffect(() => {
    if (!saveError && !attempted) return
    const message = errorRef.current?.querySelector<HTMLElement>('[data-quick-error]')
    const details = message?.closest('details')
    if (details) details.open = true
    message?.focus()
  }, [saveError, attempted, errorRef])
  function navigate(next: number) { setAttempted(false); setStep(next) }
  function advance() {
    if (pendingIssue) { setAttempted(true); return }
    navigate(step + 1)
  }
  function reviewSave() {
    if (pendingIssue) { setIndex(pendingIssue.index); navigate(guidedSteps.indexOf(issueStep(pendingIssue))); setAttempted(true); return }
    onSave()
  }
  return <div className="protocol-creation-layout guided-creation" ref={errorRef}>
    <header className="guided-topbar">
      <span>{firstProtocol ? 'Your first protocol' : 'Add protocol'}</span>
      <button type="button" className="quick-text-action" disabled={saving} onClick={onClose} aria-label={firstProtocol ? 'Not now, return to Today' : 'Close protocol setup'}>{firstProtocol ? 'Not now' : 'Close'}</button>
    </header>
    <div className="guided-progress" role="group" aria-label={review ? 'Review, setup steps complete' : `Step ${step + 1} of 4`}>
      <span>{review ? 'Review' : `${step + 1} of 4`}</span><progress max={4} value={review ? 4 : step + 1} aria-label="Setup progress" />
    </div>
    <h1 ref={heading} tabIndex={-1}>{review ? 'Does this look right?' : stepTitle(currentStep, c.route)}</h1>
    <div className="protocol-quick-start guided-content">
      {!review && <CompoundPicker key={index} idPrefix={`quick-${index}`} value={c} onExpand={() => navigate(0)} onChange={next => { update(next); if (next.name !== c.name) navigate(0) }} />}
      {!review && currentStep === 'compound' && <QuickStartError issue={visibleIssue} />}
      {!review && currentStep === 'dose' && <>
        <QuickProtocolFields section="dose" idPrefix={`quick-${index}`} value={c} onChange={update} issue={visibleIssue} />
        <details className="quick-additional">
          <summary><AppIcon name="chevron" size={16} /><span>Preparation, inventory and notes</span><small>Optional</small></summary>
          <QuickAdditionalFields includeTime={false} idPrefix={`quick-${index}`} value={c} today={today} onChange={update} issue={visibleIssue} />
        </details>
      </>}
      {!review && currentStep === 'schedule' && <QuickProtocolFields section="schedule" idPrefix={`quick-${index}`} value={c} onChange={update} issue={visibleIssue} />}
      {!review && currentStep === 'start' && <>
        <ProtocolStartDate value={value.startDate} today={today} onChange={startDate => onChange({ ...value, startDate })} issue={visibleIssue?.field === 'startDate' ? visibleIssue : null} />
        <QuickProtocolFields section="start" idPrefix={`quick-${index}`} value={c} onChange={update} issue={visibleIssue} />
      </>}
      {review && <>
        <QuickStartReview value={value} today={today} />
        {value.compounds.map((compound, i) => <div className="guided-review-edit" key={i}>
          <button className="quick-text-action" type="button" disabled={saving} onClick={() => { setIndex(i); navigate(0) }}>Edit {compound.name}</button>
          {value.compounds.length > 1 && <button className="quick-text-action" type="button" disabled={saving} onClick={() => { onChange({ ...value, compounds: value.compounds.filter((_, n) => i !== n) }); setIndex(0) }}>Remove {compound.name}</button>}
        </div>)}
        <details className="quick-additional"><summary><AppIcon name="chevron" size={16} /><span>More setup options</span></summary>
          <button className="quick-text-action" type="button" disabled={saving} onClick={() => { setIndex(value.compounds.length); onChange({ ...value, compounds: [...value.compounds, newCompound()] }); navigate(0) }}>Add another compound</button>
          {children}
        </details>
        <QuickStartError message={saveError} />
        {retryBlocked && <a className="today-text-link" href="/protocol/manage" target="_blank" rel="noopener" aria-label="Check saved protocols (opens a new tab)">Check saved protocols</a>}
      </>}
    </div>
    <footer className="guided-actions">
      {step > 0 && <button type="button" className="quick-cancel" disabled={saving} onClick={() => navigate(step - 1)} aria-label="Back to previous setup step">Back</button>}
      <button type="button" className="quick-save-primary" disabled={saving || retryBlocked} aria-disabled={!review && Boolean(pendingIssue)} aria-busy={saving} onClick={review ? reviewSave : advance}>{saving ? 'Saving…' : review ? value.startDate ? 'Start tracking' : 'Save protocol' : step === 3 ? 'Review protocol' : 'Continue'}</button>
    </footer>
  </div>
}
