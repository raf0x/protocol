'use client'
import { entryFromForm } from '../../lib/health/dosingEntry'
import { reconstitutionCheckReminder } from '../../lib/health/preparationPresentation'
import { dateLabel } from '../../lib/health/protocolPresentation'
import type { Compound } from '../../lib/protocols/form'
import { measurementPreview, updateCreation } from '../../lib/protocols/creationMeasurement'
import type { QuickStartIssue } from '../../lib/protocols/quickStart'
import { QuickAmountField, QuickChoices, QuickStartError } from './QuickStartControls'

type Props = { value: Compound; onChange: (value: Compound) => void; idPrefix: string; issue?: QuickStartIssue | null }
export function CreationPreparation({ value: c, onChange, idPrefix, issue }: Props) {
  const update = <K extends keyof Compound>(key: K, value: Compound[K]) => onChange(updateCreation(c, key, value))
  const amount = (key: 'vial_strength' | 'concentration_value', label: string, unitKey: 'vial_unit' | 'concentration_unit', options: string[]) => <QuickAmountField id={`${idPrefix}-${key}`} label={label} error={issue?.field === key || issue?.field === unitKey ? issue.message : undefined} invalid={issue?.field === unitKey ? 'unit' : 'value'} value={c[key]} onChange={v => update(key, v)} unit={{ value: c[unitKey], label: `${label} unit`, options, onChange: v => update(unitKey, v) }} />
  const mixed = c.mixingStatus ?? (c.reconstitution_date || c.bac_water_ml ? 'mixed' : undefined)
  const reminder = reconstitutionCheckReminder(c.reconstitution_date)
  const showMixingFacts = c.preparation === 'mixing' && mixed === 'mixed' || Boolean(c.bac_water_ml || c.reconstitution_date) || ['bac_water_ml', 'reconstitution_date'].includes(issue?.field || '')
  return <div className="quick-fields creation-preparation">
    {(c.preparation !== 'ready' || ['vial_strength', 'vial_unit'].includes(issue?.field || '')) && <section aria-label="Vial amount"><h2 className="creation-question">How much is in the vial?</h2>{amount('vial_strength', 'Amount in the vial', 'vial_unit', ['mg', 'mcg', 'IU'])}</section>}
    <QuickChoices label="Is it mixed?" value={c.preparation === 'ready' ? 'ready' : c.preparation === 'mixing' ? mixed || '' : ''} options={[["mixed", 'Yes'], ['unmixed', 'No'], ['ready', 'Ready to use'], ['', 'Not sure']]} onChange={v => {
      const next = updateCreation(c, 'preparation', v === 'ready' ? 'ready' : v ? 'mixing' : 'unknown')
      onChange({ ...next, mixingStatus: v === 'mixed' || v === 'unmixed' ? v : undefined })
    }} />
    {showMixingFacts && <div className="creation-mixing-facts">
      {mixed === 'unmixed' && <p className="quick-hint">Previously entered mixing facts are kept below. Edit them only if needed.</p>}
      <QuickAmountField id={`${idPrefix}-water`} error={issue?.field === 'bac_water_ml' ? issue.message : undefined} label="Bacteriostatic water added" value={c.bac_water_ml} onChange={v => update('bac_water_ml', v)} unit="mL" helper="Liquid added is separate from the final solution volume." />
      <label htmlFor={`${idPrefix}-mixed-date`}>When was it mixed?<input id={`${idPrefix}-mixed-date`} aria-label="Reconstitution date" type="date" value={c.reconstitution_date} aria-invalid={issue?.field === 'reconstitution_date'} aria-describedby={issue?.field === 'reconstitution_date' ? `${idPrefix}-mixed-date-error` : undefined} onChange={e => update('reconstitution_date', e.target.value)} /></label>
      <QuickStartError id={`${idPrefix}-mixed-date-error`} issue={issue?.field === 'reconstitution_date' ? issue : null} />
      {reminder && <p className="creation-reminder"><strong>28-day check reminder: {dateLabel(reminder)}</strong><span>Tracking only; not an expiration or safe-use date.</span></p>}
    </div>}
    {(c.preparation === 'ready' || ['concentration_value', 'concentration_unit'].includes(issue?.field || '')) && amount('concentration_value', 'Concentration on the label', 'concentration_unit', ['mg/mL', 'mcg/mL', 'IU/mL'])}
    <p className="quick-hint">Record what you know. You can leave preparation details blank.</p>
  </div>
}

export function CreationMeasurement({ value: c, onChange, idPrefix, issue }: Props) {
  const update = <K extends keyof Compound>(key: K, value: Compound[K]) => onChange(updateCreation(c, key, value))
  const modeOptions = c.route === 'Oral' ? [['medication', 'Medication amount'], ['unknown', 'Not sure']] as const : [['medication', 'Medication amount'], ['syringe', 'Syringe marking'], ['volume', 'Liquid volume'], ['unknown', 'Not sure']] as const
  return <div className="quick-fields">
    <h2 className="creation-question">{c.route === 'Oral' ? 'How much will you take?' : 'How much will you inject?'}</h2>
    <QuickChoices describedBy={issue?.field === 'input_mode' ? `${idPrefix}-mode-error` : undefined} label="What do you measure?" value={c.input_mode} options={modeOptions} onChange={v => update('input_mode', v)} />
    <QuickStartError id={`${idPrefix}-mode-error`} issue={issue?.field === 'input_mode' ? issue : null} />
    {(c.input_mode === 'medication' || issue?.field === 'dose' || issue?.field === 'dose_unit') && <QuickAmountField id={`${idPrefix}-dose`} error={issue?.field === 'dose' || issue?.field === 'dose_unit' ? issue.message : undefined} invalid={issue?.field === 'dose_unit' ? 'unit' : 'value'} label="Your intended amount" value={c.dose} onChange={v => update('dose', v)} unit={{ value: c.dose_unit, label: 'Medication unit', options: ['mg', 'mcg', 'IU'], onChange: v => update('dose_unit', v) }} />}
    {(c.input_mode === 'syringe' || c.input_mode === 'unknown' || issue?.field === 'syringe_markings') && <QuickAmountField id={`${idPrefix}-markings`} error={issue?.field === 'syringe_markings' ? issue.message : undefined} label="Syringe marking" value={c.syringe_markings} onChange={v => update('syringe_markings', v)} helper="Syringe markings are separate from medication IU." />}
    {(c.input_mode === 'volume' || c.input_mode === 'unknown' || issue?.field === 'injection_volume') && <QuickAmountField id={`${idPrefix}-volume`} error={issue?.field === 'injection_volume' ? issue.message : undefined} label="Liquid volume" value={c.injection_volume} onChange={v => update('injection_volume', v)} unit="mL" />}
    {(c.input_mode === 'syringe' || c.input_mode === 'unknown' || Boolean(c.syringe_scale)) && <><QuickChoices describedBy={issue?.field === 'syringe_scale' ? `${idPrefix}-scale-error` : undefined} label="Calibration on your syringe" value={c.syringe_scale} options={[["", 'Not confirmed'], ['100', 'U-100'], ['40', 'U-40']]} onChange={v => update('syringe_scale', v)} /><QuickStartError id={`${idPrefix}-scale-error`} issue={issue?.field === 'syringe_scale' ? issue : null} /></>}
    {((c.input_mode !== 'unknown' && (c.preparation === 'mixing' || c.preparation === 'ready')) || issue?.field === 'final_solution_volume_ml') && <details className="quick-additional">
      <summary>See a measurement equivalent (optional)</summary>
      {(c.preparation === 'mixing' || Boolean(c.final_solution_volume_ml) || issue?.field === 'final_solution_volume_ml') && <QuickAmountField id={`${idPrefix}-final`} error={issue?.field === 'final_solution_volume_ml' ? issue.message : undefined} label="Final solution volume" value={c.final_solution_volume_ml || ''} onChange={v => update('final_solution_volume_ml', v)} unit="mL" helper="Use the confirmed total volume after preparation, not the amount of liquid added." />}
      <label className="protocol-check"><input type="checkbox" checked={c.preparation_confirmed === true} onChange={e => update('preparation_confirmed', e.target.checked)} /><span>{c.preparation === 'mixing' ? 'I confirm the vial amount, unit and final solution volume' : 'I confirm the concentration and unit from the label'}</span></label>
      <label className="protocol-check"><input type="checkbox" checked={c.reviewed} onChange={e => update('reviewed', e.target.checked)} /><span>I have checked my measurement details</span></label>
      {c.input_mode !== 'syringe' && !c.syringe_scale && <QuickChoices label="Calibration on your syringe" value={c.syringe_scale} options={[["", 'Not confirmed'], ['100', 'U-100'], ['40', 'U-40']]} onChange={v => update('syringe_scale', v)} />}
      <CreationEquivalent value={c} />
      {((c.preparation === 'ready' && Boolean(c.vial_strength || c.vial_unit || c.final_solution_volume_ml)) || (c.preparation === 'mixing' && Boolean(c.concentration_value || c.concentration_unit))) && <details className="quick-additional creation-preparation-review">
        <summary>Review preparation facts</summary>
        <p className="quick-hint">A ready-to-use label does not need a final volume. If a final volume is recorded above, it is compared with the vial amount and label concentration. Edit only the facts you mean to correct.</p>
        <QuickAmountField id={`${idPrefix}-review-vial`} label="Amount in the vial" value={c.vial_strength} onChange={v => update('vial_strength', v)} unit={{ value: c.vial_unit, label: 'Amount in the vial unit', options: ['mg', 'mcg', 'IU'], onChange: v => update('vial_unit', v) }} />
        <QuickAmountField id={`${idPrefix}-review-label`} label="Concentration on the label" value={c.concentration_value} onChange={v => update('concentration_value', v)} unit={{ value: c.concentration_unit, label: 'Concentration on the label unit', options: ['mg/mL', 'mcg/mL', 'IU/mL'], onChange: v => update('concentration_unit', v) }} />
      </details>}
    </details>}
    <details className="quick-additional"><summary>How you take it (optional)</summary>
    <label className="quick-route">How do you take it?<select aria-label="How do you take it?" aria-invalid={issue?.field === 'route'} aria-describedby={issue?.field === 'route' ? `${idPrefix}-route-error` : undefined} value={c.route} onChange={e => update('route', e.target.value)}><option value="">Not specified</option>{[['SubQ', 'Under the skin (SubQ)'], ['IM', 'Into a muscle (IM)'], ['Oral', 'By mouth (Oral)'], ['Other', 'Another route']].map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select></label>
    <QuickStartError id={`${idPrefix}-route-error`} issue={issue?.field === 'route' ? issue : null} />
    </details>
    <p className="quick-hint">Use your own intended measurement. This setup does not choose an amount or a schedule.</p>
  </div>
}

const previewNumber = (value: number | null) => value === null ? '' : Number(value.toPrecision(10)).toString()

export function CreationEquivalent({ value }: { value: Compound }) {
  let result
  try { result = measurementPreview(entryFromForm(value)) } catch { return <p role="status">Review the recorded amounts to see an equivalent.</p> }
  return <div className="quick-review" aria-live="polite"><strong>Calculated for display only</strong>
    {result.medication && <p>{previewNumber(result.volume)} mL ≈ {previewNumber(result.medication.value)} {result.medication.unit}{result.markings !== null ? ` ≈ ${previewNumber(result.markings)} markings on U-${value.syringe_scale}` : ''}</p>}
    <p>{result.message}{result.medication ? ' Values are rounded for display.' : ''}</p>
  </div>
}

export function CreationFacts({ value: c }: { value: Compound }) {
  const facts: [string, string | undefined][] = [
    ['Preparation', c.preparation === 'mixing' ? 'Preparing a vial' : c.preparation === 'ready' ? 'Ready to use' : 'Preparation not specified'], ['Medication amount', c.dose ? `${c.dose} ${c.dose_unit || '(unit unknown)'}` : ''],
    ['Measurement meaning', ({ medication: 'Medication amount', syringe: 'Syringe marking', volume: 'Liquid volume', unknown: 'Not confirmed' })[c.input_mode]], ['Syringe marking', c.syringe_markings], ['Syringe calibration', c.input_mode === 'syringe' || c.syringe_markings || c.syringe_scale ? c.syringe_scale ? `U-${c.syringe_scale}` : 'Not confirmed' : ''],
    ['Liquid volume', c.injection_volume ? `${c.injection_volume} mL` : ''], ['Vial amount', c.vial_strength ? `${c.vial_strength} ${c.vial_unit || '(unit unknown)'}` : ''],
    ['Liquid added', c.bac_water_ml ? `${c.bac_water_ml} mL` : ''], ['Final solution volume', c.final_solution_volume_ml ? `${c.final_solution_volume_ml} mL` : ''],
    ['Recorded concentration', c.concentration_value ? `${c.concentration_value} ${c.concentration_unit || '(unit unknown)'}` : ''],
    ['Preparation confirmed', c.preparation_confirmed === true ? 'Yes' : 'No'], ['Measurement reviewed', c.reviewed ? 'Yes' : 'No'],
    ['Mixed on', c.reconstitution_date], ['28-day check reminder (tracking only)', reconstitutionCheckReminder(c.reconstitution_date) || ''], ['Vials in stock', c.vials_in_stock], ['Vial label', c.vial_label], ['Notes', c.notes],
  ]
  return <><strong>Facts to save</strong><dl className="creation-facts">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><CreationEquivalent value={c} /></>
}
