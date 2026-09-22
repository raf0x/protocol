import type { HealthAnalysis, HealthAnalystContext, AnalystEvidence, ContextFact, DataConfidence, EvidenceType } from '../analyst/types'
import type { DoctorReport, ReportAiSummary } from './types'

const number = (value: number) => Number(value.toPrecision(5))
const dose = (value: { value: number; unit: string } | null) => value ? `${number(value.value)} ${value.unit}` : 'dose not confirmed'

/** Build the optional report-AI request from the already-derived report model.
 * The provider never receives the raw source record from this path. AI may phrase
 * these facts, but it does not select, rank, calculate, or reinterpret them. */
export function buildReportAiContext(report: DoctorReport): HealthAnalystContext {
  const evidence: AnalystEvidence[] = []
  const facts: ContextFact[] = []
  const gaps: ContextFact[] = []
  let serial = 0

  const add = (options: {
    type: EvidenceType
    date?: string | null
    title: string
    detail: string
    sourceLabel: string
    confidence?: DataConfidence
    gap?: boolean
  }) => {
    const id = `E${++serial}`
    evidence.push({ id, type: options.type, date: options.date ?? null, title: options.title,
      detail: options.detail, confidence: options.confidence ?? 'high', sourceLabel: options.sourceLabel })
    ;(options.gap ? gaps : facts).push({ text: `${options.title}: ${options.detail}`, evidenceIds: [id] })
  }

  for (const note of report.intelligence.contextNotes) {
    if (note.kind === 'period') add({ type: 'data_gap', title: 'Report period',
      detail: note.start ? `${note.start} through ${note.end}` : `All recorded history through ${note.end}`, sourceLabel: 'Deterministic report context' })
    else if (note.kind === 'latest_panel') add({ type: 'lab_panel', date: note.date, title: 'Latest recorded lab date', detail: note.date, sourceLabel: 'Deterministic report context' })
    else if (note.kind === 'active_items') add({ type: 'protocol_state', date: note.date, title: 'Current recorded protocol state',
      detail: `${note.count} active recorded ${note.count === 1 ? 'item' : 'items'} as of ${note.date}`, sourceLabel: 'Canonical protocol replay' })
    else add({ type: 'data_gap', title: 'Recorded limitation', detail: note.text, sourceLabel: 'Deterministic verification', gap: true })
  }

  for (const finding of report.intelligence.headlineChanges.slice(0, 5)) {
    const comparison = finding.evidence.comparison
    const detail = comparison
      ? `${comparison.previous.value} ${finding.unit} on ${comparison.previous.date} to ${comparison.current.value} ${finding.unit} on ${comparison.current.date}; ${comparison.delta} ${finding.unit}${comparison.percent == null ? '' : ` (${comparison.percent}%)`} over ${comparison.elapsedDays} days.`
      : finding.evidence.current
        ? `${finding.evidence.current.value} ${finding.unit} on ${finding.evidence.current.date}. ${finding.reason}`
        : finding.reason
    const personal = finding.evidence.personalHistory
    const baseline = personal.baseline
    const history = baseline ? ` Descriptive prior median ${baseline.median} ${finding.unit}, span ${baseline.min} to ${baseline.max}, ${baseline.count} earlier dates (${baseline.start} to ${baseline.end}); latest excluded.` : ' No established personal baseline.'
    add({ type: comparison ? 'lab_comparison' : 'lab_result', date: finding.observedAt,
      title: finding.biomarkerName, detail: `${detail} ${finding.reason}${history} Assay equivalence is unverified.`, sourceLabel: 'Canonical deterministic lab finding' })
  }

  for (const item of report.currentProtocols.slice(0, 6)) add({ type: 'protocol_state', date: report.asOfDate,
    title: item.name, detail: [item.dose, item.frequency, item.route].filter(Boolean).join(' · '), sourceLabel: 'Canonical current protocol state' })

  for (const item of report.intelligence.protocolTimeline.slice(0, 4)) {
    const change = item.before || item.after ? ` ${dose(item.before)} → ${dose(item.after)}.` : ''
    add({ type: 'protocol_event', date: item.date, title: item.title, detail: `Recorded ${item.kind.replaceAll('_', ' ')}.${change}`,
      sourceLabel: item.provenance === 'event' ? 'Recorded protocol event' : 'Saved protocol history' })
  }

  for (const item of report.intelligence.verification.slice(0, 4)) add({ type: 'data_gap', title: 'Verification note',
    detail: item.text, sourceLabel: 'Deterministic verification', gap: true })

  return {
    intent: 'general',
    question: [
      'Write one concise clinician-facing overview using ONLY the supplied deterministic facts.',
      'Use 2 or 3 short sentences and no more than 80 words.',
      'Do not inventory every value. Surface the most decision-useful recorded changes, current protocol context, and one important limitation when present.',
      'Do not diagnose, recommend treatment, imply causality, call a value healthy or dangerous, or infer an external reference range.',
      'Put the entire response in summary. Return findings, uncertainties, and nextObservations as empty arrays.',
    ].join(' '),
    asOfDate: report.asOfDate,
    scope: 'Doctor Report wording over deterministic report intelligence only',
    facts,
    evidence,
    gaps,
  }
}

export function toReportAiSummary(analysis: HealthAnalysis): ReportAiSummary {
  return { overview: analysis.summary.trim() }
}
