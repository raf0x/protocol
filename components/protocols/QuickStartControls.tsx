'use client'
import AppIcon from '../app/AppIcon'
import type { QuickStartIssue } from '../../lib/protocols/quickStart'

export function QuickChoices<T extends string>({ label, value, options, onChange, className = '', describedBy }: {
  label: string; value: T; options: readonly (readonly [T, string, string?])[]; onChange: (value: T) => void; className?: string; describedBy?: string
}) {
  return <fieldset className="quick-control" aria-describedby={describedBy}><legend>{label}</legend><div className={`quick-options ${className}`}>
    {options.map(([key, text, accessibleName]) => <button type="button" key={key} aria-label={accessibleName} aria-pressed={value === key} onClick={() => onChange(key)}>
      <span>{text}</span>{value === key && <AppIcon name="check" size={14} />}
    </button>)}
  </div></fieldset>
}

export function QuickStartError({ issue, message, id }: { issue?: QuickStartIssue | null; message?: string | null; id?: string }) {
  const text = message || issue?.message
  return text ? <p id={id} role="alert" tabIndex={-1} data-quick-error className="quick-error">{text}</p> : null
}

type UnitSelect = { value: string; label: string; options: readonly (string | readonly [string, string])[]; onChange: (value: string) => void; placeholder?: string }
export function QuickAmountField({ id, label, accessibleName = label, value, onChange, unit, min = 0, step = 'any', error, invalid = 'value', helper }: {
  id: string; label: string; accessibleName?: string; value: string; onChange: (value: string) => void
  unit?: string | UnitSelect; min?: number; step?: string; error?: string | null; invalid?: 'value' | 'unit'; helper?: string
}) {
  const description = [typeof unit === 'string' && `${id}-unit`, helper && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return <div className="quick-amount-field">
    <label htmlFor={id}>{label}</label>
    <div className="quick-amount" data-invalid={Boolean(error)}>
      <input id={id} aria-label={accessibleName} aria-invalid={Boolean(error && invalid === 'value')} aria-describedby={description} type="number" inputMode={step === '1' ? 'numeric' : 'decimal'} min={min} step={step} value={value} onChange={event => onChange(event.target.value)} />
      {typeof unit === 'string' ? <span id={`${id}-unit`} className="quick-unit">{unit}</span> : unit && <select aria-label={unit.label} aria-invalid={Boolean(error && invalid === 'unit')} aria-describedby={error ? `${id}-error` : undefined} value={unit.value} onChange={event => unit.onChange(event.target.value)}>
        <option value="">{unit.placeholder || 'Choose unit'}</option>{unit.options.map(option => { const [value, label] = typeof option === 'string' ? [option, option] : option; return <option key={value} value={value}>{label}</option> })}
      </select>}
    </div>
    {helper && <p id={`${id}-hint`} className="quick-hint">{helper}</p>}
    <QuickStartError id={`${id}-error`} message={error} />
  </div>
}
