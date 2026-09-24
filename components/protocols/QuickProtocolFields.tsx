'use client'
import { useState } from 'react'
import AppIcon from '../app/AppIcon'
import { resolveCompound } from '../../lib/protocols/catalog'
import { updateCompoundDraft, type Compound } from '../../lib/protocols/form'
import { setFrequency, setPreparation, toggleQuickWeekday, type QuickStartIssue } from '../../lib/protocols/quickStart'
import { QuickAmountField, QuickChoices, QuickStartError } from './QuickStartControls'

export { QuickStartError } from './QuickStartControls'
type FieldProps = { value: Compound; onChange: (value: Compound) => void; idPrefix?: string; issue?: QuickStartIssue | null }
function draftControls(c: Compound, onChange: FieldProps['onChange'], idPrefix: string, issue?: QuickStartIssue | null) {
  const update = <K extends keyof Compound>(key: K, value: Compound[K]) => onChange(updateCompoundDraft(c, key, value))
  const numeric = (key: keyof Compound, label: string, unit?: string, min = 0, step = 'any', accessibleName = label) => <QuickAmountField id={`${idPrefix}-${key}`} label={label} accessibleName={accessibleName} value={String(c[key] ?? '')} onChange={value => update(key, value)} unit={unit} min={min} step={step} error={issue?.field === key ? issue.message : null} />
  const amount = (key: keyof Compound, label: string, unitKey: keyof Compound, unitLabel: string, options: readonly string[], accessibleName = label, helper?: string) => <QuickAmountField id={`${idPrefix}-${key}`} label={label} accessibleName={accessibleName} value={String(c[key] ?? '')} onChange={value => update(key, value)} unit={{ value: String(c[unitKey] ?? ''), label: unitLabel, options, onChange: value => update(unitKey, value) }} error={issue && [key, unitKey].includes(issue.field as keyof Compound) ? issue.message : null} invalid={issue?.field === unitKey ? 'unit' : 'value'} helper={helper} />
  return { update, numeric, amount }
}

export default function QuickProtocolFields({ value: c, onChange, issue, idPrefix = 'quick', section = 'all' }: FieldProps & { section?: 'all' | 'dose' | 'schedule' | 'start' }) {
  const { update, numeric, amount } = draftControls(c, onChange, idPrefix, issue)
  const [alternatives, setAlternatives] = useState(c.input_mode !== 'medication')
  const units = [...new Set([...(resolveCompound(c.name)?.units ?? ['mg', 'mcg', 'IU']), ...(['mg', 'mcg', 'IU'].includes(c.dose_unit) ? [c.dose_unit] : [])])]
  const frequency = c.frequencyChoice ?? (c.frequency_mode === 'rolling' ? 'custom' : c.days_of_week.length === 7 ? 'daily' : c.days_of_week.length === 1 ? 'weekly' : c.days_of_week.length === 2 ? '2x' : c.days_of_week.length === 3 ? '3x' : c.days_of_week.length ? 'custom' : '')
  return <div className="quick-fields">
    {(section === 'all' || section === 'dose') && <><div className="quick-dose" role="group" aria-label="Recorded amount" aria-describedby={issue?.field === 'input_mode' ? `${idPrefix}-method-error` : undefined}>
      {c.input_mode === 'medication' && amount('dose', c.route === 'SubQ' || c.route === 'IM' ? 'Dose per injection' : 'Medication dose', 'dose_unit', 'Medication dose unit', units)}
      {c.input_mode === 'syringe' && c.route !== 'Oral' && <>
        <QuickAmountField id={`${idPrefix}-syringe_markings`} label="Syringe markings" value={c.syringe_markings} onChange={value => update('syringe_markings', value)} unit={{ value: c.syringe_scale, label: 'Syringe scale', options: [['100', 'U-100'], ['40', 'U-40']], onChange: value => update('syringe_scale', value), placeholder: 'Choose scale' }} error={issue && ['syringe_markings', 'syringe_scale'].includes(issue.field) ? issue.message : null} invalid={issue?.field === 'syringe_scale' ? 'unit' : 'value'} helper="Syringe markings are not medication IU." />
      </>}
      {c.input_mode === 'volume' && c.route !== 'Oral' && numeric('injection_volume', 'Injection volume', 'mL', 0, 'any', 'Injection volume (mL)')}
      <button className="quick-text-action quick-method-toggle" type="button" aria-expanded={alternatives} aria-controls={`${idPrefix}-methods`} onClick={() => setAlternatives(!alternatives)}>I measure my dose another way<AppIcon name="chevron" size={14} /></button>
      {alternatives && <div id={`${idPrefix}-methods`} className="quick-methods"><QuickChoices describedBy={issue?.field === 'input_mode' ? `${idPrefix}-method-error` : undefined} label={c.input_mode === 'unknown' ? 'What measurement is on your instructions or syringe?' : 'Record dose as'} value={c.input_mode} options={c.route === 'Oral' ? [['medication', 'Medication dose'], ['unknown', 'I’m not sure']] : [["medication", c.input_mode === 'unknown' ? 'Medication dose (mg, mcg or IU)' : 'Medication dose'], ['syringe', 'Syringe markings'], ['volume', 'Injection volume'], ['unknown', 'I’m not sure']]} onChange={value => update('input_mode', value)} /></div>}
      <QuickStartError id={`${idPrefix}-method-error`} issue={issue?.field === 'input_mode' ? issue : null} />
    </div>
    <label className="quick-route">How do you take it?<select aria-label="How do you take it?" aria-invalid={issue?.field === 'route'} aria-describedby={issue?.field === 'route' ? `${idPrefix}-route-error` : undefined} value={c.route} onChange={event => update('route', event.target.value)}><option value="">Choose a route</option>{[['SubQ', 'Under the skin (SubQ)'], ['IM', 'Into a muscle (IM)'], ['Oral', 'By mouth (Oral)'], ['Other', 'Another route']].map(([route, label]) => <option key={route} value={route}>{label}</option>)}</select></label>
    <QuickStartError id={`${idPrefix}-route-error`} issue={issue?.field === 'route' ? issue : null} /></>}
    {(section === 'all' || section === 'schedule') && <><div className="quick-schedule" role="group" aria-label="Schedule" aria-describedby={issue?.field === 'days_of_week' ? `${idPrefix}-schedule-error` : undefined}>
      <QuickChoices label="Frequency" value={frequency} options={[["daily", 'Daily'], ['weekly', 'Weekly'], ['2x', '2x/week'], ['3x', '3x/week'], ['custom', 'Custom']]} onChange={value => onChange(setFrequency(c, value))} />
      {frequency === 'custom' && <label>Repeat<select aria-label="Repeat" value={c.frequency_mode} onChange={event => update('frequency_mode', event.target.value as Compound['frequency_mode'])}><option value="weekly">Choose days</option><option value="rolling">Every N days</option></select></label>}
      {frequency && frequency !== 'daily' && c.frequency_mode === 'weekly' && <fieldset className="quick-control"><legend>Which days?</legend><div className="quick-weekdays">{['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, number) => <button key={day} type="button" aria-label={day} aria-pressed={c.days_of_week.includes(number)} onClick={() => onChange(toggleQuickWeekday(c, number))}>{day.slice(0, 3)}{c.days_of_week.includes(number) && <AppIcon name="check" size={12} />}</button>)}</div></fieldset>}
      {frequency === 'custom' && c.frequency_mode === 'rolling' && numeric('cycle_days', 'Days between doses', 'days', 1, '1')}
      <QuickStartError id={`${idPrefix}-schedule-error`} issue={issue?.field === 'days_of_week' ? issue : null} />
    </div>
    {section === 'schedule' && frequency && <QuickTimeField value={c} onChange={onChange} />}</>}
    {(section === 'all' || section === 'start') && <div className="quick-duration">
      <QuickChoices label="How long will you run this protocol?" value={c.durationSet || c.duration_weeks ? 'set' : 'ongoing'} options={[["ongoing", 'No end date recorded'], ['set', 'Set a length']]} onChange={value => onChange({ ...updateCompoundDraft(c, 'duration_weeks', value === 'ongoing' ? '' : c.duration_weeks), durationSet: value === 'set' })} />
      {(c.durationSet || c.duration_weeks) && <div className="quick-weeks">{numeric('duration_weeks', 'How many weeks?', 'weeks', 1, '1')}</div>}
    </div>}
  </div>
}

export function QuickTimeField({ value: c, onChange }: FieldProps) {
  const question = c.route === 'SubQ' || c.route === 'IM' ? 'When do you inject this dose?' : c.route === 'Oral' ? 'When do you take this dose?' : 'When do you use this dose?'
  return <QuickChoices label={question} value={c.time_of_day} options={[["Morning", 'Morning'], ['Afternoon', 'Afternoon'], ['Evening', 'Evening'], ['Night', 'Night'], ['', 'Not specified']]} onChange={value => onChange(updateCompoundDraft(c, 'time_of_day', value))} />
}

export function QuickAdditionalFields({ value: c, today, onChange, idPrefix = 'quick', issue, includeTime = true }: FieldProps & { today: string; includeTime?: boolean }) {
  const { update, numeric, amount } = draftControls(c, onChange, idPrefix, issue)
  const preparation = c.isPreMixed ? 'ready' : c.preparation || (c.vial_strength || c.bac_water_ml ? 'mixing' : 'unknown')
  const mixed = c.mixDateSet ? 'date' : c.reconstitution_date === today ? 'today' : c.reconstitution_date ? 'date' : 'notyet'
  return <div className="quick-additional-fields">
    {includeTime && <QuickTimeField value={c} onChange={onChange} />}
    {c.route !== 'Oral' && <div className="quick-preparation">
      <QuickChoices label="Does the vial need mixing?" value={preparation} options={[["ready", 'Ready to use'], ['mixing', 'Needs mixing'], ['unknown', 'Not sure']]} onChange={value => onChange(setPreparation(c, value))} />
      {preparation === 'ready' && amount('concentration_value', 'What concentration is printed on the label?', 'concentration_unit', 'Concentration unit', ['mg/mL', 'mcg/mL', 'IU/mL'], 'Labeled concentration', 'Example: 5 mg/mL')}
      {preparation === 'mixing' && <>
        {amount('vial_strength', 'What is the vial strength?', 'vial_unit', 'Vial strength unit', ['mg', 'mcg', 'IU'], 'Vial strength')}
        <QuickChoices label="Has the vial already been mixed?" value={mixed} options={[["notyet", 'Not yet'], ['today', 'Mixed today'], ['date', 'Choose date']]} onChange={value => onChange({ ...updateCompoundDraft(c, 'reconstitution_date', value === 'today' ? today : value === 'date' ? c.reconstitution_date : ''), mixDateSet: value === 'date' })} />
        {mixed === 'date' && <label>Reconstitution date<input aria-label="Reconstitution date" type="date" value={c.reconstitution_date} aria-invalid={issue?.field === 'reconstitution_date'} aria-describedby={issue?.field === 'reconstitution_date' ? `${idPrefix}-mix-error` : undefined} onChange={event => update('reconstitution_date', event.target.value)} /><QuickStartError id={`${idPrefix}-mix-error`} issue={issue?.field === 'reconstitution_date' ? issue : null} /></label>}
        <QuickChoices label={mixed === 'notyet' ? 'How much BAC water will you add?' : 'How much BAC water did you add?'} value={['1', '2', '3'].includes(c.bac_water_ml) ? c.bac_water_ml : 'other'} options={[["1", '1 mL'], ['2', '2 mL'], ['3', '3 mL'], ['other', 'Other']]} onChange={value => update('bac_water_ml', value === 'other' ? '' : value)} />
        {!['1', '2', '3'].includes(c.bac_water_ml) && numeric('bac_water_ml', 'BAC water', 'mL', 0, 'any', 'BAC water (mL)')}
      </>}
    </div>}
    <div><label htmlFor={`${idPrefix}-stock`}>Vials in stock</label><div className="quick-stepper">
      <button type="button" aria-label="One fewer vial" disabled={!c.vials_in_stock || Number(c.vials_in_stock) <= 0} onClick={() => update('vials_in_stock', String(Math.max(0, Number(c.vials_in_stock) - 1)))}>−</button>
      <input id={`${idPrefix}-stock`} aria-label="Vials in stock" aria-invalid={issue?.field === 'vials_in_stock'} aria-describedby={issue?.field === 'vials_in_stock' ? `${idPrefix}-stock-error` : undefined} type="number" min="0" step="1" inputMode="numeric" value={c.vials_in_stock} onChange={event => update('vials_in_stock', event.target.value)} />
      <button type="button" aria-label="One more vial" onClick={() => update('vials_in_stock', String(Number(c.vials_in_stock || 0) + 1))}>+</button>
    </div><QuickStartError id={`${idPrefix}-stock-error`} issue={issue?.field === 'vials_in_stock' ? issue : null} /><p>Your inventory quantity stays unchanged.</p></div>
    <label>Notes<textarea aria-label="Notes" rows={2} value={c.notes} onChange={event => update('notes', event.target.value)} /></label>
  </div>
}
