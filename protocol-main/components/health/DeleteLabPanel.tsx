'use client'
import {useEffect,useRef,useState} from 'react'
import {deleteLabPanel} from '../../lib/health/loadLabs'
import type {LabPanel} from '../../lib/health/labs'
import styles from '../../app/health/health.module.css'

export default function DeleteLabPanel({panel,onClose,onDeleted}:{panel:LabPanel;onClose:()=>void;onDeleted:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),pending=useRef(false)
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>{dialog.current?.showModal()},[])
  async function remove(){if(pending.current)return;pending.current=true;setBusy(true);setError('');try{await deleteLabPanel(panel);onDeleted()}catch(reason){setError(reason instanceof Error?reason.message:'Unable to delete.')}finally{pending.current=false;setBusy(false)}}
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby="delete-lab-title" onCancel={event=>{event.preventDefault();if(!busy)onClose()}}>
    <h2 id="delete-lab-title">Delete this lab panel?</h2><p>{panel.panel_name||'This panel'} and all {panel.results.length} results inside it will be permanently deleted. Its Timeline entry will also disappear.</p>
    {error&&<p role="alert">{error}</p>}<div className={styles.headerLinks}><button type="button" disabled={busy} onClick={onClose} autoFocus>Keep panel</button><button type="button" disabled={busy} onClick={()=>void remove()}>{busy?'Deleting…':'Delete panel and results'}</button></div>
  </dialog>
}
