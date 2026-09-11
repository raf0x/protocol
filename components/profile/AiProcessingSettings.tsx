'use client'

import { useState } from 'react'
import styles from './ProfileSafety.module.css'

export default function AiProcessingSettings({ initialConsent }: { initialConsent: boolean }) {
  const [consented, setConsented] = useState(initialConsent)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  async function revoke() {
    setSaving(true); setMessage('')
    try {
      const response = await fetch('/api/ai-consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: false }) })
      if (!response.ok) throw new Error()
      setConsented(false); setMessage('AI processing permission revoked.')
    } catch { setMessage('AI settings could not be updated. Try again.') }
    setSaving(false)
  }
  return <section className={styles.card} aria-labelledby="ai-settings-heading">
    <div className={styles.row}><div><h2 id="ai-settings-heading">AI data processing</h2><p>AI features send selected relevant health data to OpenAI only after you give permission.</p><span className={styles.status}>{consented ? 'Permission granted' : 'Permission not granted'}</span></div>
      {consented && <button className={styles.button} type="button" onClick={() => void revoke()} disabled={saving}>{saving ? 'Updating…' : 'Revoke'}</button>}
    </div>
    {message && <p className={styles.message} role="status" aria-live="polite">{message}</p>}
  </section>
}
