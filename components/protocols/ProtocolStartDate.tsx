'use client'
import { useState } from 'react'
import { QuickChoices, QuickStartError } from './QuickStartControls'
import type { QuickStartIssue } from '../../lib/protocols/quickStart'

export default function ProtocolStartDate({ value, today, onChange, issue }: { value: string; today: string; onChange: (date: string) => void; issue?: QuickStartIssue | null }) {
  const [choosing, setChoosing] = useState(Boolean(value && value !== today))
  return <div className="quick-start-date">
    <QuickChoices label="Start date" value={choosing ? 'date' : value ? 'today' : 'unknown'} options={[["today", 'Today'], ['date', 'Another date'], ['unknown', 'I don’t know yet']]} onChange={choice => {
      setChoosing(choice === 'date')
      onChange(choice === 'today' ? today : choice === 'unknown' ? '' : value || today)
    }} />
    {choosing && <label className="quick-date-entry">Start date<input aria-label="Protocol start date" type="date" required value={value} aria-invalid={Boolean(issue)} aria-describedby={issue ? 'quick-start-date-error' : undefined} onChange={event => { if (event.target.value) onChange(event.target.value) }} /></label>}
    <QuickStartError id="quick-start-date-error" issue={issue} />
  </div>
}
