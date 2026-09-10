'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { LabsAuthError, loadLabs } from '../../lib/health/loadLabs'
import { biomarkerHistories, panelSummary, type LabPanel } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import AddLabForm from './AddLabForm'
import LabPanelCard from './LabPanelCard'
import LabResultRow from './LabResultRow'
import BiomarkerTrend from './BiomarkerTrend'
import ImportLabForm from './ImportLabForm'
import DeleteLabPanel from './DeleteLabPanel'
import styles from '../../app/health/health.module.css'

export default function HealthDashboard() {
  const router = useRouter()
  const query = useSearchParams()
  const [panels, setPanels] = useState<LabPanel[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState<LabPanel | null>(null)
  const adding = query.get('action') === 'add'
  const editing = query.get('action') === 'edit'
  const importing = query.get('action') === 'csv' ? 'csv' : query.get('action') === 'pdf' ? 'pdf' : null
  const panelId = query.get('panel')
  const panel = panels.find(item => item.id === panelId)
  const histories = useMemo(() => biomarkerHistories(panels).filter(item => item.panelCount > 1), [panels])
  useEffect(() => {
    let cancelled = false
    loadLabs().then(data => { if (!cancelled) { setPanels(data); setStatus('ready') } }).catch(error => {
      if (cancelled) return
      if (error instanceof LabsAuthError) { router.replace('/auth/login'); return }
      setMessage(error instanceof Error ? error.message : 'Unable to load labs.'); setStatus('error')
    })
    return () => { cancelled = true }
  }, [router, attempt])
  function retry() { setStatus('loading'); setAttempt(value => value + 1) }
  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.eyebrow}>Your health, over time</span><h1>{importing ? 'Import lab results' : editing ? 'Edit lab panel' : adding ? 'Add lab results' : panelId ? 'Lab panel' : 'Health'}</h1><p>Lab results and check-ins, in one place.</p>
      <div className={styles.headerLinks}><Link href="/health">Labs</Link><Link href="/journal">Journal history</Link>{!adding && !importing && !editing && <details className={styles.importMenu}><summary>Add / Import</summary><Link href="/health?action=add">Add manually</Link><Link href="/health?action=csv">Import CSV</Link><Link href="/health?action=pdf">Import PDF</Link></details>}</div>
    </header>
    {saved && <p role="status" className={styles.notice}>Lab results saved.</p>}
    {status === 'loading' && <p role="status">Loading your lab history…</p>}
    {status === 'error' && <div className={styles.card} role="alert"><h2>Labs are temporarily unavailable</h2><p>{message}</p><button onClick={retry} type="button">Try again</button></div>}
    {status === 'ready' && ((adding || (editing && panel)) ? <AddLabForm key={editing?panelId:'new'} original={editing?panel:null} panels={panels} onCancel={() => router.push(editing?`/health?panel=${panelId}`:'/health')} onSaved={id => { setSaved(true); retry(); router.push(`/health?panel=${encodeURIComponent(id)}`) }} /> : importing ? <ImportLabForm key={importing} kind={importing} panels={panels} onCancel={()=>router.push('/health')} onSaved={id=>{setSaved(true);retry();router.push(`/health?panel=${encodeURIComponent(id)}`)}} /> : panelId ? panel ? <>
      <section className={styles.card}><span className={styles.eyebrow}>{panel.source_type==='manual'?'Manual entry':`${panel.source_type.toUpperCase()} import`}</span><h2>{panel.panel_name || 'Lab results'}</h2><time dateTime={panel.test_date}>{formatTimelineDate(panel.test_date)}</time>{panel.provider && <p>{panel.provider}</p>}<p className={styles.summary}>{panelSummary(panel.results)}</p>
        <div className={styles.headerLinks}><Link className={styles.primary} href={`/health?panel=${panel.id}&action=edit`}>Edit panel</Link><button type="button" onClick={()=>setDeleting(panel)}>Delete panel</button></div>
        {panel.notes && <details className={styles.formDetails}><summary>Panel notes</summary><p className={styles.notes}>{panel.notes}</p></details>}
        {panel.source_filename && <details className={styles.formDetails}><summary>Import provenance</summary><p>{panel.source_filename}</p><pre className={styles.raw}>{JSON.stringify(panel.source_metadata,null,2)}</pre></details>}
      </section>
      <section className={styles.card} aria-label="Biomarker results"><h2>Results</h2><p className={styles.caption}>Status reflects the supplied lab interpretation or numeric reference bounds. It is not a diagnosis.</p>{panel.results.length ? panel.results.map(result => <div key={result.id}><LabResultRow result={result} />{result.source_raw&&<details className={styles.formDetails}><summary>Original source · {result.import_confidence} parser confidence</summary><pre className={styles.raw}>{JSON.stringify(result.source_raw,null,2)}</pre></details>}</div>) : <p>No results recorded in this panel.</p>}</section>
      <Link className={styles.textLink} href="/health">Back to all panels & trends</Link>
    </> : <section className={styles.card}><h2>Panel unavailable</h2><p>This panel is not available in your account.</p><Link href="/health">View your panels</Link></section> : <>
      <section aria-labelledby="panels-heading"><div className={styles.sectionHeading}><h2 id="panels-heading">Recent panels</h2><span>{panels.length}</span></div>{panels.length ? <div className={styles.panelList}>{panels.map(item => <LabPanelCard key={item.id} panel={item} />)}</div> : <div className={styles.card}><h3>Your lab history starts here</h3><p>Add the values from a lab report. Reference ranges are optional.</p><Link className={styles.textLink} href="/health?action=add">Add your first panel</Link></div>}</section>
      <section aria-labelledby="trends-heading"><div className={styles.sectionHeading}><h2 id="trends-heading">Biomarker trends</h2></div>{histories.length ? <><p className={styles.caption}>Matching names are grouped exactly. Units are never converted.</p>{histories.map(history => <BiomarkerTrend key={history.name} history={history} />)}</> : <div className={styles.card}><h3>A clearer view with repeat results</h3><p>Record the same biomarker in another panel to see its history. Use the same name and unit as your report.</p></div>}</section>
    </>)}
    {deleting&&<DeleteLabPanel panel={deleting} onClose={()=>setDeleting(null)} onDeleted={()=>{setDeleting(null);setSaved(false);retry();router.push('/health')}} />}
  </main>
}
