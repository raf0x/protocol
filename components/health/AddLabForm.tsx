'use client'

import { useMemo, useRef, useState } from 'react'
import { labStatuses, prepareLabDraft, type LabDraft, type LabDraftRow, type LabPanel } from '../../lib/health/labs'
import { saveLabPanelV2 } from '../../lib/health/loadLabs'
import { draftFromPanel, duplicateRows } from '../../lib/health/labEditor'
import { formatTimelineDate } from '../../lib/health/timeline'
import LabResultRow from './LabResultRow'
import styles from '../../app/health/health.module.css'

const blankRow = (): LabDraftRow => ({ biomarker_name: '', entry: '', unit: '', reference_low: '', reference_high: '', reference_text: '', status: '' })
export default function AddLabForm({ onSaved, onCancel, initialDraft, original = null, panels = [] }: { onSaved: (id: string) => void; onCancel: () => void; initialDraft?: LabDraft; original?: LabPanel | null; panels?: LabPanel[] }) {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState<LabDraft>(() => initialDraft ?? (original ? draftFromPanel(original) : { test_date: '', panel_name: '', provider: '', notes: '', results: [blankRow()] }))
  const [rowKeys, setRowKeys] = useState(() => draft.results.map((_,index) => index))
  const nextKey = useRef(draft.results.length)
  const [confirmed, setConfirmed] = useState(false)
  const imported = draft.source_type === 'csv' || draft.source_type === 'pdf'
  const duplicates = useMemo(() => duplicateRows(draft,panels,original?.id),[draft,panels,original?.id])
  const selectedDraft = { ...draft, results: draft.results.filter(row => row.included !== false) }
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const pending = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  function go(value: number) { setStep(value); setConfirmed(false); setError(''); heading.current?.focus(); window.scrollTo({ top: 0, behavior: 'instant' }) }
  function update(index: number, field: keyof LabDraftRow, value: string) {
    setDraft(current => ({ ...current, results: current.results.map((row, i) => i === index ? { ...row, [field]: value } : row) }))
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current) return
    setError('')
    try {
      if (step === 1) { go(2); return }
      prepareLabDraft(selectedDraft)
      if (step === 2) { go(3); return }
      pending.current = true; setSaving(true)
      const id = await saveLabPanelV2(draft,original,confirmed)
      onSaved(id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save. Your entries are still here.') }
    finally { pending.current = false; setSaving(false) }
  }
  const review = step === 3 ? prepareLabDraft(selectedDraft) : null
  return <form onSubmit={submit} className={styles.form}>
    <h2 ref={heading} tabIndex={-1}>{step === 1 ? 'About this test' : step === 2 ? 'Add your biomarkers' : 'Review your results'}</h2>
    <p className={styles.caption}>Step {step} of 3 · {original ? 'Edit saved panel' : imported ? `${draft.source_type?.toUpperCase()} import` : 'Manual entry'}</p>
    {imported && <p className={styles.notice}>Review every included row against {draft.source_filename}. One test date applies to this panel. Exclude rows belonging to other tests or dates. Nothing is saved until you confirm.</p>}
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
          {imported && <label className={styles.checkLabel}><input type="checkbox" checked={row.included !== false} onChange={event => setDraft({ ...draft, results: draft.results.map((item,i) => i===index ? {...item,included:event.target.checked} : item) })} />Include this result</label>}
          {row.import_confidence && <p className={styles.notice} data-confidence={row.import_confidence}>{row.import_confidence[0].toUpperCase()+row.import_confidence.slice(1)} parser confidence{row.warnings?.length ? ` · ${row.warnings.join(' ')}` : ''}</p>}
          {duplicates.has(index) && <p className={styles.notice}>Possible duplicate: same date, name, value and unit. Keep it intentionally or exclude/remove this row.</p>}
          {row.source_raw && <details className={styles.formDetails}><summary>Original source row</summary><pre className={styles.raw}>{JSON.stringify(row.source_raw,null,2)}</pre></details>}
          <label>Biomarker name<input required={row.included !== false} maxLength={200} value={row.biomarker_name} onChange={event => update(index, 'biomarker_name', event.target.value)} /></label>
          <div className={styles.fieldGrid}><label>Result<input required={row.included !== false} maxLength={200} value={row.entry} onChange={event => update(index, 'entry', event.target.value)} placeholder="Number or report text" /></label><label>Unit <small>If supplied</small><input maxLength={80} value={row.unit} onChange={event => update(index, 'unit', event.target.value)} /></label></div>
          <details className={styles.formDetails}><summary>Reference range & lab status <span>Optional</span></summary>
            <div className={styles.fieldGrid}><label>Reference low<input inputMode="decimal" value={row.reference_low} onChange={event => update(index, 'reference_low', event.target.value)} /></label><label>Reference high<input inputMode="decimal" value={row.reference_high} onChange={event => update(index, 'reference_high', event.target.value)} /></label></div>
            <label>Reference text<textarea maxLength={1000} rows={2} value={row.reference_text} onChange={event => update(index, 'reference_text', event.target.value)} placeholder="Copy any qualifiers or context from the report" /></label>
            <label>Status printed on the report<select value={row.status} onChange={event => update(index, 'status', event.target.value)}><option value="">Not supplied: use numeric bounds if available</option>{labStatuses.map(status => <option key={status} value={status}>{status[0].toUpperCase() + status.slice(1)}</option>)}</select></label>
            <p className={styles.caption}>An explicit lab status is preserved. Without numeric bounds or a reported status, the result stays Unknown.</p>
          </details>
        </section>)}
        <button type="button" disabled={draft.results.length >= 500} onClick={() => { setDraft({ ...draft, results: [...draft.results, blankRow()] }); setRowKeys([...rowKeys, nextKey.current++]) }}>+ Add biomarker</button><p className={styles.caption}>{draft.results.length} of 500 biomarkers</p>
      </>}
      {review && <div className={styles.card}><h3>{review.panel.panel_name || 'Lab results'}</h3><p>{formatTimelineDate(review.panel.test_date)}{review.panel.provider && ` · ${review.panel.provider}`}</p>{review.panel.notes && <p className={styles.notes}>{review.panel.notes}</p>}{review.results.map((result, index) => <LabResultRow result={result} key={index} />)}
        {duplicates.size>0 && <p className={styles.notice}>{duplicates.size} possible duplicate rows included. Go Back to exclude them, or keep them by confirming this save.</p>}
        {imported && <label className={styles.checkLabel}><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)} />I reviewed all included rows, dates, units, parser warnings and possible duplicates.</label>}
        <p className={styles.caption}>{review.results.length} results will be saved. Check names, values, units, and ranges before saving.</p></div>}
      <div className={styles.actions}><button type="button" onClick={() => step === 1 ? onCancel() : go(step - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button><button type="submit" className={styles.primary}>{saving ? 'Saving…' : step === 1 ? 'Add biomarkers' : step === 2 ? 'Review results' : 'Save lab results'}</button></div>
    </fieldset>
  </form>
}
