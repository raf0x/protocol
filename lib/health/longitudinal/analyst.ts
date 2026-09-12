import type { AnalystEvidence, ContextFact } from '../analyst/types'
import { buildLongitudinal } from './engine'
import { addDays, numberLabel } from './dates'
import { healthStateAtDate } from './history'
import type { LongitudinalSource } from './types'
import { comparableLabObservations } from './presentation'

/** A deliberately small projection, with no database IDs, raw entries, notes,
 * filenames or source metadata. Only protocol-context requests call this. */
export function longitudinalAnalystEvidence(source: LongitudinalSource, today: string) {
  const result = buildLongitudinal(source, today)
  const chosen = comparableLabObservations(result.observations).slice(0, 3)
  const evidence: AnalystEvidence[] = [], facts: ContextFact[] = []
  for (const [index, item] of chosen.entries()) {
    const id = `longitudinal:${index}`, latest = item.changes.at(-1)!, reading = item.followups.find(row => row.id === latest.measurementId)!
    const state = (date: string) => healthStateAtDate(source, date).slice(0, 10).map(row => ({ name: row.name, medication: row.medication,
      frequency: row.frequency, route: row.route, provenance: row.provenance, limitations: row.limitations }))
    const detail = `${item.metric.name}: ${numberLabel(item.baseline!.value)} ${item.metric.unit} on ${item.baseline!.date} to ${numberLabel(reading.value)} ${item.metric.unit} on ${reading.date}; ${latest.direction} by ${numberLabel(Math.abs(latest.delta))} ${item.metric.unit}, ${latest.daysAfter} days after ${item.intervention.title}. Timing only, not causality.`
    evidence.push({ id, type: 'longitudinal_observation', date: reading.date, title: item.intervention.title,
      detail, confidence: 'low', sourceLabel: 'Deterministic longitudinal comparison', longitudinal: {
        intervention: { date: item.intervention.date, type: item.intervention.kind, title: item.intervention.title, before: item.intervention.before, after: item.intervention.after, provenance: item.intervention.provenance },
        baseline: { date: item.baseline!.date, value: item.baseline!.value, unit: item.baseline!.unit, source: item.baseline!.source.table, reference: item.baseline!.reference },
        followups: item.changes.slice(-3).map(change => { const row = item.followups.find(row => row.id === change.measurementId)!; return {
          date: row.date, value: row.value, unit: row.unit, source: row.source.table, reference: row.reference,
          delta: change.delta, percent: change.percent, direction: change.direction, daysAfter: change.daysAfter, daysBetween: change.daysBetween,
        } }),
        window: item.window, followupDates: item.followups.length, strength: item.strength,
        confounders: item.confounders.slice(0, 10).map(change => ({ date: change.date, title: change.title })), confounderCount: item.confounders.length,
        stateBefore: state(addDays(item.intervention.date, -1)), stateAtFollowup: state(reading.date),
        limitations: [...item.limitations, ...result.limitations, 'Context shows at most three comparisons, three readings per comparison and ten regimen entries/overlapping changes; it is not a complete causal model.'],
      } })
    facts.push({ text: detail, evidenceIds: [id] })
  }
  return { evidence, facts, gaps: chosen.length ? [] : [{ text: 'No comparable lab baseline/follow-up pair was found around the loaded protocol changes. Do not reconstruct an association from unrelated dates or journal metrics.', evidenceIds: [] }] }
}

export function longitudinalRegimenEvidence(source: LongitudinalSource, date: string) {
  const evidence: AnalystEvidence[] = healthStateAtDate(source, date).map((row, index) => ({
    id: `regimen:${index}`, type: 'protocol_state', date, title: row.name, confidence: 'low', sourceLabel: 'Date-resolved regimen context',
    detail: `${row.medication ? `${numberLabel(row.medication.value)} ${row.medication.unit}` : 'Medication dose not confirmed'}${row.frequency ? `, ${row.frequency}` : ''}${row.route ? `, ${row.route}` : ''}. ${row.limitations.join(' ')}`,
  }))
  return { evidence, facts: evidence.map(row => ({ text: `${row.title} at ${date}: ${row.detail}`, evidenceIds: [row.id] })) }
}
