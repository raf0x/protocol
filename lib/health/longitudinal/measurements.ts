import { biomarkerHistories } from '../labs'
import { day } from './dates'
import type { LongitudinalSource, Measurement } from './types'

/** Match only the existing conservative biomarker registry and exact trimmed units.
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
  // Existing journal inputs and displays use pounds; profile weight_unit is a
  // display preference, not a historical per-row unit. Do not reinterpret it.
  const fields = [
    ['weight', 'Weight', 'lb', true, Number.MAX_VALUE], ['sleep', 'Sleep', 'hours', true, 24],
    ['mood', 'Mood', '/5', false, 5], ['energy', 'Energy', '/5', false, 5], ['hunger', 'Hunger', '/5', false, 5],
  ] as const
  for (const entry of source.journal) {
    const date = day(entry.date)
    if (!date || date > asOf) continue
    for (const [key, name, unit, percentageAllowed, maximum] of fields) {
      const value = entry[key]
      if (value == null || !Number.isFinite(value) || (key === 'weight' ? value <= 0 : value < (key === 'sleep' ? 0 : 1)) || value > maximum) continue
      rows.push({ id: `journal:${entry.id}:${key}`, key, name, type: key === 'weight' ? 'weight' : 'journal', date,
        value, unit, percentageAllowed, source: { table: 'journal_entries', id: entry.id, label: 'Journal check-in' },
        original: { name, value, unit, sourceType: 'journal' } })
    }
  }
  return [...new Map(rows.map(row => [row.id, row])).values()].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
}
