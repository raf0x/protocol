import { biomarkerHistories } from '../labs'
import { day } from './dates'
import type { LongitudinalSource, Measurement } from './types'

/** Match only the existing conservative biomarker registry and exact trimmed units.
 * Labs only: journal metrics remain available elsewhere in the app.
 * No analyte-dependent unit conversion or qualitative-to-numeric coercion. */
export function normalizeMeasurements(source: LongitudinalSource, asOf: string): Measurement[] {
  const rows: Measurement[] = []
  const panels = new Map(source.panels.map(panel => [panel.id, panel]))
  for (const history of biomarkerHistories(source.panels)) for (const group of history.units) for (const item of group.observations) {
    const date = day(item.date), result = item.result
    if (!date || date > asOf || result.value == null || !Number.isFinite(result.value) || result.value_text) continue
    const panel = panels.get(item.panelId)
    rows.push({ id: `lab:${result.id}`, key: `lab:${history.key}`, name: history.name, type: 'lab', date,
      value: result.value, unit: group.unit, percentageAllowed: true,
      source: { table: 'lab_results', id: result.id, parentId: item.panelId, label: panel?.panel_name || 'Lab panel' },
      original: { name: result.biomarker_name, value: result.value, unit: result.unit, sourceType: panel?.source_type || 'lab' },
      reference: { low: result.reference_low, high: result.reference_high, text: result.reference_text } })
  }
  return [...new Map(rows.map(row => [row.id, row])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}
