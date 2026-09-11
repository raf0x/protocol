'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import styles from './ProfileSafety.module.css'

export default function DeleteAccount() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [message, setMessage] = useState('')

  async function removeAccount() {
    if (confirmation !== 'DELETE' || deleting) return
    setDeleting(true); setMessage('')
    try {
      const response = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation }) })
      const body = await response.json() as { error?: string }
      if (!response.ok) throw new Error(body.error || 'Account deletion could not be completed.')
      try { await createClient().auth.signOut({ scope: 'local' }) } catch {}
      try { localStorage.clear(); sessionStorage.clear() } catch {}
      try { await Promise.all((await caches.keys()).map(key => caches.delete(key))) } catch {}
      window.location.replace('/')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Account deletion could not be completed.')
      setDeleting(false)
    }
  }

  return <section className={`${styles.card} ${styles.dangerCard}`} aria-labelledby="delete-account-heading">
    <h2 id="delete-account-heading">Account</h2>
    <p>Delete your account and all MyPepProtocol protocols, health records, Labs data, and settings.</p>
    {!open ? <button className={`${styles.button} ${styles.dangerToggle}`} type="button" onClick={() => setOpen(true)}>Delete account</button> :
      <div className={styles.confirm} role="group" aria-labelledby="delete-confirm-heading">
        <p id="delete-confirm-heading"><strong>This is permanent and cannot be undone.</strong> Type DELETE to confirm.</p>
        <label htmlFor="delete-account-confirmation">Confirmation</label>
        <input className={styles.input} id="delete-account-confirmation" value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} placeholder="DELETE" disabled={deleting} />
        {message && <p className={styles.message} role="alert">{message}</p>}
        <div className={styles.actions}><button className={styles.button} type="button" onClick={() => { setOpen(false); setConfirmation(''); setMessage('') }} disabled={deleting}>Cancel</button><button className={styles.danger} type="button" onClick={() => void removeAccount()} disabled={confirmation !== 'DELETE' || deleting}>{deleting ? 'Deleting…' : 'Delete forever'}</button></div>
      </div>}
  </section>
}
