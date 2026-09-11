'use client'

import { FormEvent, useState } from 'react'
import type { AnalystResult } from '../../lib/health/analyst/types'
import styles from '../../app/health/health.module.css'

const suggestions = ['What changed since my last labs?', 'Summarize my current health picture',
  'Show protocol changes around my latest labs', 'Which biomarkers changed the most?', 'What information is missing?']

export default function HealthAnalyst() {
  const [question, setQuestion] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<AnalystResult | null>(null)
  const [message, setMessage] = useState('')
  async function ask(value: string) {
    const prompt = value.trim()
    if (prompt.length < 3 || status === 'loading') return
    setQuestion(prompt); setStatus('loading'); setMessage(''); setResult(null)
    try {
      const response = await fetch('/api/health-analyst', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: prompt }) })
      const body = await response.json() as AnalystResult & { error?: string }
      if (!response.ok) throw new Error(body.error || 'The analyst is temporarily unavailable.')
      setResult(body); setStatus('ready')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The analyst is temporarily unavailable.'); setStatus('error') }
  }
  function submit(event: FormEvent) { event.preventDefault(); void ask(question) }
  const evidence = new Map(result?.evidence.map(item => [item.id, item]))
  return <section className={styles.analyst} aria-labelledby="analyst-heading">
    <div className={styles.analystIntro}><span className={styles.analystIcon} aria-hidden="true">✦</span><div><span className={styles.eyebrow}>Evidence first</span><h2 id="analyst-heading">Ask your health history</h2><p>Compare your recorded labs, protocols, weight, and check-ins. When you ask, selected recorded health data is processed by the configured AI provider. Answers show supporting evidence and never replace clinical care.</p></div></div>
    <div className={styles.promptGrid} aria-label="Suggested questions">{suggestions.map(prompt => <button key={prompt} type="button" onClick={() => void ask(prompt)} disabled={status === 'loading'}>{prompt}<span aria-hidden="true">›</span></button>)}</div>
    <form className={styles.analystForm} onSubmit={submit}><label htmlFor="analyst-question">Ask another question</label><div><input id="analyst-question" value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} placeholder="Ask about changes in your recorded health data" /><button className={styles.primary} type="submit" disabled={status === 'loading' || question.trim().length < 3}>Ask</button></div></form>
    {status === 'loading' && <div className={styles.analystStatus} role="status"><span aria-hidden="true" />Preparing an evidence-based answer…</div>}
    {status === 'error' && <div className={styles.analystError} role="alert"><strong>Analysis unavailable</strong><p>{message}</p></div>}
    {result && <article className={styles.analysisResult} aria-live="polite"><header><span className={styles.eyebrow}>Summary</span><p>{result.analysis.summary}</p></header>
      {result.analysis.findings.length > 0 && <section><h3>What stands out</h3><div className={styles.findingList}>{result.analysis.findings.map((finding, index) => <div className={styles.finding} key={`${finding.title}-${index}`}><div className={styles.findingHeading}><strong>{finding.title}</strong><span data-confidence={finding.confidence}>{finding.confidence} data confidence</span></div><p>{finding.detail}</p><details className={styles.evidence}><summary>View evidence</summary><ul>{finding.evidenceIds.map(id => { const item = evidence.get(id); return item ? <li key={id}><div><strong>{item.title}</strong>{item.date && <time dateTime={item.date}>{item.date}</time>}</div><p>{item.detail}</p><small>{item.sourceLabel} · {item.confidence} data confidence</small></li> : null })}</ul></details></div>)}</div></section>}
      {result.analysis.uncertainties.length > 0 && <section className={styles.analysisNotes}><h3>What is uncertain</h3><ul>{result.analysis.uncertainties.map(item => <li key={item}>{item}</li>)}</ul></section>}
      {result.analysis.nextObservations.length > 0 && <section className={styles.analysisNotes}><h3>What to watch next</h3><ul>{result.analysis.nextObservations.map(item => <li key={item}>{item}</li>)}</ul></section>}
      <p className={styles.analystDisclaimer}>This summarizes recorded data. It does not diagnose conditions or establish why a change happened.</p></article>}
  </section>
}
