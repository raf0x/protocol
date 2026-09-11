'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './AiConsentDialog.module.css'

export default function AiConsentDialog({ open, onCancel, onGranted }: { open: boolean; onCancel: () => void; onGranted: () => void }) {
  const continueRef = useRef<HTMLButtonElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) continueRef.current?.focus() }, [open])
  if (!open) return null

  async function grant() {
    setSaving(true); setError('')
    try {
      const response = await fetch('/api/ai-consent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ consent: true }) })
      if (!response.ok) throw new Error('Consent could not be saved. No health data was sent.')
      onGranted()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Consent could not be saved.'); setSaving(false) }
  }

  return <div className={styles.backdrop} onKeyDown={event => { if (event.key === 'Escape' && !saving) onCancel() }}>
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="ai-consent-title" aria-describedby="ai-consent-copy">
      <span className={styles.eyebrow}>Your choice</span>
      <h2 id="ai-consent-title">Allow AI processing?</h2>
      <p id="ai-consent-copy">For the analysis you request, MyPepProtocol will send selected relevant health data to OpenAI.</p>
      <ul>
        <li>Only evidence scoped to your request is sent.</li>
        <li>The information is processed with your request to produce the answer.</li>
        <li>AI output may be inaccurate and does not replace professional medical care.</li>
      </ul>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.actions}>
        <button className={styles.cancel} type="button" onClick={onCancel} disabled={saving}>Cancel</button>
        <button ref={continueRef} className={styles.continue} type="button" onClick={() => void grant()} disabled={saving}>{saving ? 'Saving…' : 'Continue'}</button>
      </div>
    </section>
  </div>
}
