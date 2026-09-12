import { biomarkerHistories } from '../labs'
import { buildLabTrajectory, toLabEvidenceObservation } from '../labEvidence'
import { day } from './dates'
import type { LongitudinalSource, Measurement } from './types'

/** Match only the existing conservative biomarker registry and exact trimmed units.
 * Labs only: journal metrics remain available elsewhere in the app.
 * No analyte-dependent unit conversion or qualitative-to-numeric coercion. */
export function normalizeMeasurements(source: LongitudinalSource, asOf: string): Measurement[] {
  const rows: Measurement[] = []
  const panels = new Map(source.panels.map(panel => [panel.id, panel]))
  for (const history of biomarkerHistories(source.panels)) for (const group of history.units) {
    // Keep every source on a date, including unusable/qualitative companions.
    // Numeric-only normalization must not hide same-day ambiguity downstream.
    const sources = group.observations.map(item => toLabEvidenceObservation(item, history.key))
    const dates = new Map(buildLabTrajectory(sources).dates.map(group => [group.date, group]))
    for (const [index, item] of group.observations.entries()) {
      const date = day(item.date), result = item.result
      const normalized = sources[index]
      if (!date || date > asOf || normalized.value == null || normalized.issues.includes('qualitative_value')) continue
      const panel = panels.get(item.panelId)
      rows.push({ id: `lab:${result.id}`, key: `lab:${history.key}`, name: history.name, type: 'lab', date,
        value: normalized.value, unit: group.unit, percentageAllowed: true,
        source: { table: 'lab_results', id: result.id, parentId: item.panelId, label: panel?.panel_name || 'Lab panel' },
        original: { name: result.biomarker_name, value: normalized.value, unit: result.unit, sourceType: panel?.source_type || 'lab' },
        reference: { low: result.reference_low, high: result.reference_high, text: result.reference_text }, labDate: dates.get(date) })
    }
  }
  return [...new Map(rows.map(row => [row.id, row])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}
