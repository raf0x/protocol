'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ProtocolDialog from '../protocols/ProtocolDialog'
import { confirmInventoryImport, deleteInventoryItem, loadInventory } from '../../lib/inventory/client'
import { FORMS, UNITS, RECONSTITUTION, INVENTORY_HEADERS, MAX_FILE_BYTES, TEMPLATE_URL, importableRows, previewInventory, type InputRow, type InventoryPreview, type SavedInventoryItem } from '../../lib/inventory/model'
import '../../app/protocol/manage/protocols.css'
import styles from '../../app/protocol/inventory/inventory.module.css'

const labels: Record<string, string> = { item_name: 'Item or compound name', form: 'Form', vial_strength: 'Vial strength', strength_unit: 'Strength unit', quantity: 'Quantity', acquisition_date: 'Acquisition date', expiration_date: 'Expiration date', lot_number: 'Lot / batch number', reconstitution_status: 'Reconstitution status', reconstitution_date: 'Reconstitution date', notes: 'Notes' }
const options: Record<string, readonly string[]> = { form: FORMS, strength_unit: UNITS, reconstitution_status: RECONSTITUTION }
const today = () => new Date().toLocaleDateString('en-CA')
const message = (error: unknown) => error instanceof Error ? error.message : 'This action could not be completed. Try again.'
const counted = (count: number, singular: string) => `${count} ${singular}${count === 1 ? '' : 's'}`

export default function Inventory() {
  const [items, setItems] = useState<SavedInventoryItem[]>([])
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [preview, setPreview] = useState<InventoryPreview | null>(null), [confirmed, setConfirmed] = useState(false)
  const [deleting, setDeleting] = useState<SavedInventoryItem | null>(null), [source, setSource] = useState('')
  const [manual, setManual] = useState<Record<string, string>>({})
  const pending = useRef(false), requestId = useRef('')
  useEffect(() => { let live = true; loadInventory().then(rows => { if (live) { setItems(rows); setLoaded(true) } }).catch(reason => { if (live) setError(message(reason)) }); return () => { live = false } }, [])

  async function refresh() { const rows = await loadInventory(); setItems(rows); setLoaded(true); return rows }
  async function review(rows: InputRow[], name: string) {
    // Refresh duplicates before preview, never write during this step.
    const existing = await refresh()
    setPreview(previewInventory(rows, existing, today())); setSource(name)
    requestId.current = crypto.randomUUID(); setConfirmed(false)
  }
  async function open(file?: File) {
    if (!file || pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice(''); setPreview(null); setConfirmed(false)
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Choose an .xlsx file.')
      if (file.size > MAX_FILE_BYTES) throw new Error('Choose an .xlsx file up to 2 MB.')
      const { readInventoryWorkbook } = await import('../../lib/inventory/workbook')
      await review(readInventoryWorkbook(new Uint8Array(await file.arrayBuffer()), file.name), file.name)
    } catch (reason) { setError(message(reason)) }
    finally { pending.current = false; setBusy(false) }
  }
  async function save() {
    if (!preview || !confirmed || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try {
      const result = await confirmInventoryImport(preview, requestId.current, confirmed)
      setNotice(`Imported ${result.inserted} inventory record${result.inserted === 1 ? '' : 's'}. ${result.duplicates} duplicate${result.duplicates === 1 ? '' : 's'} skipped at confirmation.`)
      setPreview(null); setConfirmed(false)
      await refresh()
    } catch (reason) { setError(message(reason)) }
    finally { pending.current = false; setBusy(false) }
  }
  async function remove() {
    if (!deleting || pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await deleteInventoryItem(deleting.id); setItems(rows => rows.filter(row => row.id !== deleting.id)); setDeleting(null); setNotice('Inventory record deleted.') }
    catch (reason) { setError(message(reason)) }
    finally { pending.current = false; setBusy(false) }
  }
  const counts = preview && { valid: importableRows(preview).length, warning: preview.rows.filter(row => row.warnings.length).length, duplicate: preview.rows.filter(row => row.duplicate).length, invalid: preview.rows.filter(row => row.errors.length).length }
  return <main className={styles.page}>
    <Link href="/protocol">Back to Today</Link>
    <header><h1>Inventory</h1><p>Record what you have, before you use it.</p></header>
    <p className={styles.secondary}>These records stand alone. Protocol “vials in stock” counts remain separate and are not added here.</p>
    <section className={styles.card} aria-label="Add inventory">
      <h2>Add inventory</h2>
      <div className={styles.actions}><a href={TEMPLATE_URL} download>Download Excel template</a><label className={styles.upload}>Upload completed template<input aria-label="Upload inventory workbook" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={busy} onChange={event => { void open(event.target.files?.[0]); event.target.value = '' }} /></label></div>
      <p className={styles.secondary}>Up to 500 rows · 2 MB · .xlsx only. The file stays on your device. Review comes before save.</p>
      <details><summary>Add one item manually</summary><form onSubmit={async event => {
        event.preventDefault(); if (pending.current) return
        pending.current = true; setBusy(true); setError(''); setNotice(''); setPreview(null)
        try { await review([{ rowNumber: 1, values: manual }], 'Manual entry') } catch (reason) { setError(message(reason)) }
        finally { pending.current = false; setBusy(false) }
      }}><div className={styles.fields}>{INVENTORY_HEADERS.filter(field => field !== 'row_type').map(field => <label key={field}>{labels[field]}{['item_name', 'quantity'].includes(field) ? ' (required)' : ''}
        {options[field] ? <select value={manual[field] ?? ''} onChange={event => setManual({ ...manual, [field]: event.target.value })}><option value="">Not recorded</option>{options[field].map(option => <option key={option}>{option}</option>)}</select> : field === 'notes' ? <textarea maxLength={2000} value={manual[field] ?? ''} onChange={event => setManual({ ...manual, [field]: event.target.value })} /> : <input required={['item_name', 'quantity'].includes(field)} type={field.endsWith('_date') ? 'date' : ['quantity', 'vial_strength'].includes(field) ? 'number' : 'text'} min={field === 'quantity' ? 1 : field === 'vial_strength' ? 0 : undefined} step={field === 'vial_strength' ? 'any' : undefined} value={manual[field] ?? ''} onChange={event => setManual({ ...manual, [field]: event.target.value })} />}
      </label>)}</div><button disabled={busy} type="submit">Review item</button></form></details>
    </section>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status" className={styles.notice}>{notice}</p>}
    {busy && <p role="status">Working…</p>}
    {preview && counts && <section className={styles.card} aria-labelledby="preview-title">
      <h2 id="preview-title">Review inventory</h2><p>{source}</p>
      <ul className={styles.counts}><li>{counted(counts.valid, 'valid new row')}</li><li>{counted(counts.warning, 'row')} with warnings</li><li>{counted(counts.duplicate, 'duplicate')}</li><li>{counted(counts.invalid, 'invalid row')}</li></ul>
      <p>{counted(preview.examples, 'example row')} excluded. Only valid new rows will be imported; warnings need your review.</p>
      <p className={styles.secondary}>Duplicates match every saved field after trimming surrounding spaces. Quantity, notes, dates, units and case must match. Nothing is merged.</p>
      <div className={styles.tableWrap}><table className={styles.preview}><caption>Uploaded rows and validation results</caption><thead><tr><th>Row</th><th>Item and details</th><th>Review</th></tr></thead><tbody>{preview.rows.map(row => <tr key={row.rowNumber}>
        <td data-label="Row">{row.rowNumber}</td><td data-label="Item"><strong>{row.item.item_name || 'Missing item name'}</strong><dl>{Object.entries(row.item).filter(([key]) => key !== 'item_name').map(([key, val]) => <div key={key}><dt>{labels[key]}</dt><dd>{val == null ? 'Not recorded' : String(val)}</dd></div>)}</dl></td>
        <td data-label="Review"><strong>{row.errors.length ? 'Invalid — not imported' : row.duplicate ? 'Duplicate — not imported' : row.warnings.length ? `Valid with warning${row.warnings.length === 1 ? '' : 's'}` : 'Valid'}</strong>
          {row.errors.length > 0 && <div><p>Errors</p><ul aria-label="Errors">{row.errors.map(text => <li key={text}>{text}</li>)}</ul></div>}
          {row.warnings.length > 0 && <div><p>Warnings</p><ul aria-label="Warnings">{row.warnings.map(text => <li key={text}>{text}</li>)}</ul></div>}
        </td>
      </tr>)}</tbody></table></div>
      {!preview.rows.length && <p>No item rows found. Add your items below the example row in the template.</p>}
      <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy || !counts.valid} onChange={event => setConfirmed(event.target.checked)} />I reviewed the rows and warnings. Import {counted(counts.valid, 'valid new record')} only.</label>
      <div className={styles.actions}><button type="button" disabled={busy || !confirmed || !counts.valid} onClick={save}>Confirm import</button><button type="button" disabled={busy} onClick={() => { setPreview(null); setConfirmed(false) }}>Cancel preview</button></div>
    </section>}
    <section aria-labelledby="current-inventory"><div className={styles.heading}><h2 id="current-inventory">Current inventory</h2><button type="button" disabled={busy} onClick={() => { setError(''); void refresh().catch(reason => setError(message(reason))) }}>Refresh</button></div>
      {!loaded ? <p role="status">{error ? 'Inventory is unavailable. Use Refresh to retry.' : 'Loading inventory…'}</p> : !items.length ? <div className={styles.card}><h3>No inventory recorded yet</h3><p>Download the template or add an item manually. Saving inventory does not create a protocol.</p></div> : <div className={styles.items}>{items.map(item => <article className={styles.card} key={item.id}>
        <h3>{item.item_name}</h3><p><strong>{item.quantity}</strong> · {item.form}{item.vial_strength !== null ? ` · ${item.vial_strength} ${item.strength_unit}` : ''}</p>
        <Link className={styles.useProtocol} href={`/protocol/manage?new=1&inventory=${encodeURIComponent(item.id)}`} aria-label={`Use ${item.item_name} in a protocol`}>Use in a protocol</Link>
        <dl>{['acquisition_date', 'expiration_date', 'lot_number', 'reconstitution_status', 'reconstitution_date', 'notes'].map(key => <div key={key}><dt>{labels[key]}</dt><dd>{String(item[key as keyof SavedInventoryItem] ?? 'Not recorded')}</dd></div>)}</dl>
        <button type="button" disabled={busy} onClick={() => { setError(''); setDeleting(item) }}>Delete {item.item_name}</button>
      </article>)}</div>}
    </section>
    {deleting && <ProtocolDialog title="Delete inventory record" onClose={() => { if (!busy) setDeleting(null) }}><div className={styles.dialog}><h2>Delete {deleting.item_name}?</h2><p>This removes this inventory record. Your protocols and their vial counts are unchanged.</p>{error && <p role="alert">{error}</p>}<div className={styles.actions}><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Cancel</button><button type="button" disabled={busy} onClick={remove}>Delete record</button></div></div></ProtocolDialog>}
  </main>
}
