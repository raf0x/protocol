'use client'
import { useRef, useState } from 'react'
import { detectColumns, importFields, mapCsv, parseCsv, parsePdfLines, type ColumnMap, type CsvTable } from '../../lib/health/labImport'
import type { LabDraft, LabPanel } from '../../lib/health/labs'
import AddLabForm from './AddLabForm'
import styles from '../../app/health/health.module.css'

export default function ImportLabForm({kind,panels,onSaved,onCancel}:{kind:'csv'|'pdf';panels:LabPanel[];onSaved:(id:string)=>void;onCancel:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[filename,setFilename]=useState('')
  const [table,setTable]=useState<CsvTable|null>(null),[mapping,setMapping]=useState<ColumnMap|null>(null),[draft,setDraft]=useState<LabDraft|null>(null)
  const pending=useRef(false)
  async function open(file:File|undefined) {
    if(!file||pending.current)return
    pending.current=true;setBusy(true);setError('');setTable(null);setDraft(null)
    try {
      if(file.size>(kind==='pdf'?10_000_000:2_000_000))throw new Error(`Use a ${kind.toUpperCase()} under ${kind==='pdf'?10:2} MB.`)
      if(!file.name.toLowerCase().endsWith(`.${kind}`))throw new Error(`Choose a .${kind} file.`)
      setFilename(file.name)
      const data=new Uint8Array(await file.arrayBuffer())
      if(kind==='csv') {
        const encoding=data[0]===255&&data[1]===254?'utf-16le':data[0]===254&&data[1]===255?'utf-16be':'utf-8'
        const parsed=parseCsv(new TextDecoder(encoding,{fatal:true}).decode(data));setTable(parsed);setMapping(detectColumns(parsed.headers))
      }else {
        const {extractPdfText}=await import('../../lib/health/pdfImport')
        const lines=await extractPdfText(data);setDraft(parsePdfLines(lines,file.name))
      }
    }catch(reason){setError(reason instanceof Error && !(reason instanceof TypeError)?reason.message:'This file could not be decoded. Export a UTF-8 CSV or an unlocked text PDF.')}
    finally{pending.current=false;setBusy(false)}
  }
  if(draft)return <><button type="button" onClick={()=>setDraft(null)}>Back to import</button>
    {kind==='pdf' && <details className={styles.formDetails}><summary>Extracted text: check for missing results</summary><pre className={styles.raw}>{JSON.stringify(draft.source_metadata?.extracted_lines,null,2)}</pre></details>}
    <AddLabForm key={filename} initialDraft={draft} panels={panels} onSaved={onSaved} onCancel={onCancel} /></>
  return <section className={styles.form}><h2>Import {kind.toUpperCase()}</h2><p className={styles.secondary}>Files are parsed on your device. Review comes before save. {kind==='pdf'?'Embedded text only; scanned PDFs and OCR are not supported yet.':'One panel per import. Names and units are not converted.'}</p>
    {error&&<p role="alert" className={styles.notice}>{error}</p>}
    <label>Choose {kind.toUpperCase()} file<input type="file" accept={kind==='pdf'?'.pdf,application/pdf':'.csv,text/csv'} disabled={busy} onChange={event=>{void open(event.target.files?.[0]);event.target.value=''}} /></label>
    {busy&&<p role="status">Reading file… Nothing is being saved.</p>}
    {table&&mapping&&<form onSubmit={event=>{event.preventDefault();try{setDraft(mapCsv(table,mapping,filename));setError('')}catch(reason){setError(reason instanceof Error?reason.message:'Check column mapping.')}}}>
      <h3>Match columns</h3><p className={styles.caption}>Detected mappings are selected. Adjust only what needs changing. {table.rows.length} rows found.</p>
      {importFields.map(field=><label key={field}>{field==='biomarker'?'Biomarker name':field==='value'?'Result':field[0].toUpperCase()+field.slice(1)}<select value={mapping[field]} onChange={event=>setMapping({...mapping,[field]:Number(event.target.value)})}><option value={-1}>Not in this file</option>{table.headers.map((header,index)=><option key={index} value={index}>{index+1}: {header||'(unnamed column)'}</option>)}</select></label>)}
      <details className={styles.formDetails}><summary>Preview original rows</summary><pre className={styles.raw}>{JSON.stringify(table.rows.slice(0,3),null,2)}</pre></details>
      <button type="submit" className={styles.primary}>Continue to review</button>
    </form>}
    <button type="button" onClick={onCancel} disabled={busy}>Cancel import</button>
  </section>
}
