'use client'

import { useRef, useState } from 'react'
import { labStatuses, prepareLabDraft, type LabDraft, type LabDraftRow } from '../../lib/health/labs'
import { saveLabPanel } from '../../lib/health/loadLabs'
import { formatTimelineDate } from '../../lib/health/timeline'
import LabResultRow from './LabResultRow'
import styles from '../../app/health/health.module.css'

const blankRow = (): LabDraftRow => ({ biomarker_name: '', entry: '', unit: '', reference_low: '', reference_high: '', reference_text: '', status: '' })
export default function AddLabForm({ onSaved, onCancel }: { onSaved: (id: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<LabDraft>({ test_date: '', panel_name: '', provider: '', notes: '', results: [blankRow()] })
  const [rowKeys, setRowKeys] = useState([0])
  const nextKey = useRef(1)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  function go(value: number) { setStep(value); setError(''); heading.current?.focus(); window.scrollTo({ top: 0, behavior: 'instant' }) }
  function update(index: number, field: keyof LabDraftRow, value: string) {
    setDraft(current => ({ ...current, results: current.results.map((row, i) => i === index ? { ...row, [field]: value } : row) }))
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current) return
    setError('')
    try {
      if (step === 1) { go(2); return }
      prepareLabDraft(draft)
      if (step === 2) { go(3); return }
      pending.current = true; setSaving(true)
      const id = await saveLabPanel(draft)
      onSaved(id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save. Your entries are still here.') }
    finally { pending.current = false; setSaving(false) }
  }
  const review = step === 3 ? prepareLabDraft(draft) : null
  return <form onSubmit={submit} className={styles.form}>
    <h2 ref={heading} tabIndex={-1}>{step === 1 ? 'About this test' : step === 2 ? 'Add your biomarkers' : 'Review your results'}</h2>
    <p className={styles.caption}>Step {step} of 3 · Manual entry</p>
    <p className={styles.secondary}>Copy values and reference ranges from your report. Status labels describe the report, not a diagnosis.</p>
    {error && <p className={styles.notice} role="alert">{error}</p>}
    <fieldset disabled={saving}>
      {step === 1 && <div className={styles.card}>
        <label>Test date<input type="date" required value={draft.test_date} onChange={event => setDraft({ ...draft, test_date: event.target.value })} /></label>
        <label>Panel name <small>Optional</small><input maxLength={200} value={draft.panel_name} onChange={event => setDraft({ ...draft, panel_name: event.target.value })} /></label>
        <label>Provider or lab <small>Optional</small><input maxLength={200} value={draft.provider} onChange={event => setDraft({ ...draft, provider: event.target.value })} /></label>
        <label>Notes <small>Optional</small><textarea maxLength={10000} rows={3} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} /></label>
      </div>}
      {step === 2 && <>
        {draft.results.map((row, index) => <section className={styles.card} key={rowKeys[index]} aria-label={`Biomarker ${index + 1}`}>
          <div className={styles.rowHeading}><h3>Biomarker {index + 1}</h3>{draft.results.length > 1 && <button type="button" aria-label={`Remove biomarker ${index + 1}`} onClick={() => { setDraft({ ...draft, results: draft.results.filter((_, i) => i !== index) }); setRowKeys(rowKeys.filter((_, i) => i !== index)) }}>Remove</button>}</div>
          <label>Biomarker name<input required maxLength={200} value={row.biomarker_name} onChange={event => update(index, 'biomarker_name', event.target.value)} /></label>
          <div className={styles.fieldGrid}><label>Result<input required maxLength={200} value={row.entry} onChange={event => update(index, 'entry', event.target.value)} placeholder="Number or report text" /></label><label>Unit <small>If supplied</small><input maxLength={80} value={row.unit} onChange={event => update(index, 'unit', event.target.value)} /></label></div>
          <details className={styles.formDetails}><summary>Reference range & lab status <span>Optional</span></summary>
            <div className={styles.fieldGrid}><label>Reference low<input inputMode="decimal" value={row.reference_low} onChange={event => update(index, 'reference_low', event.target.value)} /></label><label>Reference high<input inputMode="decimal" value={row.reference_high} onChange={event => update(index, 'reference_high', event.target.value)} /></label></div>
            <label>Reference text<textarea maxLength={1000} rows={2} value={row.reference_text} onChange={event => update(index, 'reference_text', event.target.value)} placeholder="Copy any qualifiers or context from the report" /></label>
            <label>Status printed on the report<select value={row.status} onChange={event => update(index, 'status', event.target.value)}><option value="">Not supplied: use numeric bounds if available</option>{labStatuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
            <p className={styles.caption}>An explicit lab status is preserved. Without numeric bounds or a reported status, the result stays Unknown.</p>
          </details>
        </section>)}
        <button type="button" disabled={draft.results.length >= 500} onClick={() => { setDraft({ ...draft, results: [...draft.results, blankRow()] }); setRowKeys([...rowKeys, nextKey.current++]) }}>+ Add biomarker</button><p className={styles.caption}>{draft.results.length} of 500 biomarkers</p>
      </>}
      {review && <div className={styles.card}><h3>{review.panel.panel_name || 'Lab results'}</h3><p>{formatTimelineDate(review.panel.test_date)}{review.panel.provider && ` · ${review.panel.provider}`}</p>{review.panel.notes && <p className={styles.notes}>{review.panel.notes}</p>}{review.results.map((result, index) => <LabResultRow result={result} key={rowKeys[index]} />)}<p className={styles.caption}>Check names, values, units, and ranges before saving. Saved panels are read-only in V1.</p></div>}
      <div className={styles.actions}><button type="button" onClick={() => step === 1 ? onCancel() : go(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button><button type="submit" className={styles.primary}>{saving ? 'Saving…' : step === 1 ? 'Add biomarkers' : step === 2 ? 'Review results' : 'Save lab results'}</button></div>
    </fieldset>
  </form>
}
