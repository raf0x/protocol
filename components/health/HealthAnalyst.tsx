'use client'

import { useState } from 'react'
import type { GuidedAnalystAction } from '../../lib/health/analyst/actions'
import type { AnalystResult } from '../../lib/health/analyst/types'
import styles from '../../app/health/health.module.css'
import AiConsentDialog from './AiConsentDialog'

const guidedActions: { action: GuidedAnalystAction; label: string }[] = [
  { action: 'since_last_labs', label: 'What changed since my last labs?' },
  { action: 'current_snapshot', label: 'Current health snapshot' },
  { action: 'largest_changes', label: 'Largest recorded lab changes' },
  { action: 'missing_data', label: 'What information is missing?' },
  { action: 'protocol_context', label: 'Protocol timing around latest labs' },
]

type AnalystApiBody = AnalystResult & { error?: string; code?: string; retryAfter?: number }
type UiError = { title: string; message?: string }

/**
 * Analyst output is structured JSON, but summary/detail fields are strings.
 * Render them as scan lines instead of dense prose. Server prompts prefer
 * newline-delimited facts; semicolon/sentence splitting is only a safe visual
 * fallback and never changes the underlying health facts.
 */
function scanLines(value: string, max: number) {
  const clean = value.trim()
  if (!clean) return []
  const newline = clean.split(/\r?\n/).map(line => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean)
  if (newline.length > 1) return newline.slice(0, max)
  const semicolon = clean.split(/;\s+/).map(line => line.trim()).filter(Boolean)
  if (semicolon.length > 1) return semicolon.slice(0, max)
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(line => line.trim()).filter(Boolean)
  return (sentences.length > 1 ? sentences : [clean]).slice(0, max)
}

export default function HealthAnalyst() {
  const [selectedAction, setSelectedAction] = useState<GuidedAnalystAction | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<AnalystResult | null>(null)
  const [uiError, setUiError] = useState<UiError | null>(null)
  const [consentOpen, setConsentOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<GuidedAnalystAction | null>(null)

  async function run(action: GuidedAnalystAction) {
    if (status === 'loading') return
    setSelectedAction(action)
    setStatus('loading')
    setUiError(null)
    setResult(null)
    try {
      const response = await fetch('/api/health-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const body = await response.json() as AnalystApiBody
      if (response.status === 403 && body.code === 'AI_CONSENT_REQUIRED') {
        setPendingAction(action)
        setStatus('idle')
        setConsentOpen(true)
        return
      }
      if (response.status === 429 && body.code === 'RATE_LIMITED') {
        const minutes = Math.max(1, Math.ceil(Number(body.retryAfter ?? 60) / 60))
        setUiError({ title: 'Analysis limit reached', message: `You've reached the analysis limit. Try again in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.` })
        setStatus('error')
        return
      }
      if (body.code === 'RATE_LIMIT_UNAVAILABLE') {
        setUiError({ title: 'Analysis temporarily unavailable', message: body.error || 'No health data was sent.' })
        setStatus('error')
        return
      }
      if (!response.ok) {
        if (response.status === 502) setUiError({ title: "Couldn't complete this analysis reliably", message: 'Try again later.' })
        else if (response.status === 401) setUiError({ title: 'Sign in required', message: body.error || 'Sign in to use the health analyst.' })
        else setUiError({ title: 'Health analysis is temporarily unavailable.' })
        setStatus('error')
        return
      }
      setResult(body)
      setStatus('ready')
    } catch {
      setUiError({ title: 'Health analysis is temporarily unavailable.' })
      setStatus('error')
    }
  }

  const evidence = new Map(result?.evidence.map(item => [item.id, item]))
  const findingLimit = selectedAction === 'largest_changes' ? 5 : 3
  const visibleFindings = result?.analysis.findings.slice(0, findingLimit) ?? []
  const visibleUncertainties = result?.analysis.uncertainties.slice(0, 2) ?? []
  const summaryLines = result ? scanLines(result.analysis.summary, 3) : []

  return <section className={styles.analyst} aria-labelledby="analyst-heading">
    <AiConsentDialog
      open={consentOpen}
      onCancel={() => { setConsentOpen(false); setPendingAction(null) }}
      onGranted={() => {
        const pending = pendingAction
        setConsentOpen(false)
        setPendingAction(null)
        if (pending) void run(pending)
      }}
    />

    <div className={styles.analystIntro}>
      <span className={styles.analystIcon} aria-hidden="true">✦</span>
      <div>
        <span className={styles.eyebrow}>Evidence first</span>
        <h2 id="analyst-heading">Understand your recorded health</h2>
        <p>Choose a focused view of your recorded evidence.</p>
      </div>
    </div>

    <div
      className={styles.promptGrid}
      aria-label="Guided health analysis"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))' }}
    >
      {guidedActions.map(item => {
        const active = selectedAction === item.action
        const loading = active && status === 'loading'
        return <button
          key={item.action}
          type="button"
          data-analyst-action={item.action}
          className={active ? styles.primary : undefined}
          aria-pressed={active}
          aria-busy={loading}
          onClick={() => void run(item.action)}
          disabled={status === 'loading'}
        >
          {item.label}<span aria-hidden="true">{loading ? '…' : '›'}</span>
        </button>
      })}
    </div>

    {status === 'loading' && <div className={styles.analystStatus} role="status"><span aria-hidden="true" />Preparing this evidence view…</div>}
    {status === 'error' && uiError && <div className={styles.analystError} role="alert"><strong>{uiError.title}</strong>{uiError.message && <p>{uiError.message}</p>}</div>}

    {result && <article className={styles.analysisResult} aria-live="polite">
      <header>
        <span className={styles.eyebrow}>At a glance</span>
        <ul className={styles.analystSummaryList}>{summaryLines.map((line, index) => <li key={`${line}-${index}`}>{line}</li>)}</ul>
      </header>

      {visibleFindings.length > 0 && <section>
        <h3>Highlights</h3>
        <div className={styles.findingList}>{visibleFindings.map((finding, index) => {
          const facts = scanLines(finding.detail, 4)
          return <div className={styles.finding} key={`${finding.title}-${index}`}>
            <div className={styles.findingHeading}><strong>{finding.title}</strong></div>
            <ul className={styles.analystFactList}>{facts.map((fact, factIndex) => <li key={`${fact}-${factIndex}`}>{fact}</li>)}</ul>
            <details className={styles.evidence}>
              <summary>View evidence</summary>
              <ul>{finding.evidenceIds.map(id => {
                const item = evidence.get(id)
                return item ? <li key={id}>
                  <div><strong>{item.title}</strong>{item.date && <time dateTime={item.date}>{item.date}</time>}</div>
                  <p>{item.detail}</p>
                  <small>{item.sourceLabel}</small>
                </li> : null
              })}</ul>
            </details>
          </div>
        })}</div>
      </section>}

      {visibleUncertainties.length > 0 && <section className={styles.analysisNotes}>
        <h3>Evidence limits</h3>
        <ul>{visibleUncertainties.map(item => <li key={item}>{item}</li>)}</ul>
      </section>}

      <p className={styles.analystDisclaimer}>This summarizes recorded data and does not establish why a change happened.</p>
    </article>}
  </section>
}
