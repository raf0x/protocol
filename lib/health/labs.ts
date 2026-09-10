export const labStatuses = ['low', 'normal', 'high', 'abnormal', 'unknown'] as const
export type LabStatus = typeof labStatuses[number]
export type LabStatusSource = 'reported' | 'derived' | 'unknown'
export type LabResult = {
  source_row_index?: number | null; source_raw?: Record<string, unknown> | null; import_confidence?: 'high' | 'medium' | 'low' | null
  created_at?: string; updated_at?: string
  id: string; lab_panel_id: string; user_id: string; biomarker_name: string; canonical_name: string | null
  value: number | null; value_text: string | null; unit: string
  reference_low: number | null; reference_high: number | null; reference_text: string | null
  status: LabStatus; status_source: LabStatusSource; category: string | null
}
export type LabPanel = {
  source_filename?: string | null; source_metadata?: Record<string, unknown> | null
  id: string; user_id: string; test_date: string; panel_name: string | null; provider: string | null
  notes: string | null; source_type: string; created_at: string; updated_at: string; results: LabResult[]
}
export type LabDraftRow = { biomarker_name: string; entry: string; unit: string; reference_low: string; reference_high: string; reference_text: string; status: LabStatus | ''; id?: string; included?: boolean; source_row_index?: number; source_raw?: Record<string, unknown>; import_confidence?: 'high' | 'medium' | 'low'; warnings?: string[] }
export type LabDraft = { test_date: string; panel_name: string; provider: string; notes: string; results: LabDraftRow[]; source_type?: 'manual' | 'csv' | 'pdf'; source_filename?: string; source_metadata?: Record<string, unknown> }
export type LabResultInput = Pick<LabResult, 'biomarker_name' | 'value' | 'value_text' | 'unit' | 'reference_low' | 'reference_high' | 'reference_text' | 'status' | 'status_source'>

export function resolveLabStatus(value: number | null, low: number | null, high: number | null, reported: LabStatus | '' = ''): { status: LabStatus; status_source: LabStatusSource } {
  if (reported) return { status: reported, status_source: 'reported' }
  if (value == null || (low == null && high == null)) return { status: 'unknown', status_source: 'unknown' }
  return { status: low != null && value < low ? 'low' : high != null && value > high ? 'high' : 'normal', status_source: 'derived' }
}

const numeric = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i
function boundedText(value: string, label: string, max: number) {
  const text = value.trim()
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`)
  return text
}
function rangeValue(value: string): number | null {
  if (!value.trim()) return null
  if (!numeric.test(value.trim()) || !Number.isFinite(Number(value))) throw new Error('Reference bounds must be numbers. Use reference text for other ranges.')
  return Number(value)
}
export function prepareLabDraft(draft: LabDraft) {
  const day = new Date(`${draft.test_date}T12:00:00Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.test_date) || !Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== draft.test_date || draft.test_date.startsWith('0000')) throw new Error('Enter a valid test date.')
  if (draft.results.length < 1 || draft.results.length > 500) throw new Error('Add between 1 and 500 biomarkers.')
  const results: LabResultInput[] = draft.results.map((row, index) => {
    const biomarker_name = boundedText(row.biomarker_name, 'Biomarker name', 200)
    const entry = boundedText(row.entry, 'Result', 200)
    if (!biomarker_name || !entry) throw new Error(`Biomarker ${index + 1} needs a name and result.`)
    if (/^[+-]?(?:nan|infinity)$/i.test(entry)) throw new Error('Enter a finite result or the text printed on the report.')
    const value = numeric.test(entry) ? Number(entry) : null
    if (value != null && !Number.isFinite(value)) throw new Error('Numeric results must be finite.')
    const reference_low = rangeValue(row.reference_low), reference_high = rangeValue(row.reference_high)
    if (reference_low != null && reference_high != null && reference_low > reference_high) throw new Error('Reference low cannot exceed reference high.')
    if (row.status && !labStatuses.includes(row.status)) throw new Error('Choose a valid lab status.')
    return { biomarker_name, value, value_text: value == null ? entry : null, unit: boundedText(row.unit, 'Unit', 80), reference_low, reference_high,
      reference_text: boundedText(row.reference_text, 'Reference text', 1000) || null, ...resolveLabStatus(value, reference_low, reference_high, row.status) }
  })
  return { panel: { test_date: draft.test_date, panel_name: boundedText(draft.panel_name, 'Panel name', 200) || null, provider: boundedText(draft.provider, 'Provider', 200) || null, notes: boundedText(draft.notes, 'Notes', 10000) || null }, results }
}

export function labValue(result: Pick<LabResult, 'value' | 'value_text' | 'unit'>) {
  return `${result.value != null ? result.value : result.value_text ?? 'Not recorded'}${result.unit ? ` ${result.unit}` : ''}`
}
export function labReference(result: Pick<LabResult, 'reference_low' | 'reference_high' | 'reference_text'>) {
  const { reference_low: low, reference_high: high, reference_text: text } = result
  const bounds = low != null && high != null ? `${low}–${high}` : low != null ? `≥ ${low}` : high != null ? `≤ ${high}` : ''
  return [bounds, text].filter(Boolean).join(' · ') || 'Reference not supplied'
}
export function panelSummary(results: Pick<LabResult, 'status'>[]) {
  const counts = (['high', 'low', 'abnormal'] as const).map(status => ({ status, count: results.filter(result => result.status === status).length }))
  return [`${results.length} ${results.length === 1 ? 'biomarker' : 'biomarkers'} measured`, ...counts.filter(item => item.count).map(item => `${item.count} ${item.status}`)].join(' · ')
}

export type LabObservation = { date: string; panelId: string; result: LabResult }
export type BiomarkerHistory = { name: string; units: { unit: string; observations: LabObservation[] }[]; panelCount: number }
/** Names and units are compared exactly after trim. No synonym or unit conversions. */
export function biomarkerHistories(panels: LabPanel[]): BiomarkerHistory[] {
  const names = new Map<string, LabObservation[]>()
  for (const panel of panels) for (const result of panel.results) {
    const name = result.biomarker_name.trim()
    const observations = names.get(name) ?? []
    observations.push({ date: panel.test_date, panelId: panel.id, result })
    names.set(name, observations)
  }
  return [...names].sort(([a], [b]) => a.localeCompare(b)).map(([name, observations]) => {
    const units = new Map<string, LabObservation[]>()
    observations.sort((a, b) => b.date.localeCompare(a.date) || a.result.id.localeCompare(b.result.id))
    for (const item of observations) {
      const unit = item.result.unit.trim()
      const group = units.get(unit) ?? []
      group.push(item); units.set(unit, group)
    }
    return { name, panelCount: new Set(observations.map(item => item.panelId)).size, units: [...units].sort(([a], [b]) => a.localeCompare(b)).map(([unit, items]) => ({ unit, observations: items })) }
  })
}

/** A chart is only appropriate for known equal units, numeric values, and
 * unique dates. All observations remain visible even when the chart is omitted. */
export function trendPoints(observations: LabObservation[]) {
  if (observations.length < 2 || !observations[0].result.unit.trim() || observations.some(item => item.result.unit.trim() !== observations[0].result.unit.trim() || item.result.value == null || !Number.isFinite(item.result.value))) return []
  if (new Set(observations.map(item => item.date)).size !== observations.length) return []
  const ordered = [...observations].sort((a, b) => a.date.localeCompare(b.date))
  const dates = ordered.map(item => Date.parse(`${item.date}T12:00:00Z`))
  if (dates.some(date => !Number.isFinite(date))) return []
  const values = ordered.map(item => item.result.value!)
  const min = Math.min(...values), max = Math.max(...values)
  return ordered.map((item, index) => ({ x: 12 + (dates[index] - dates[0]) / (dates.at(-1)! - dates[0]) * 276, y: max === min ? 60 : 108 - (item.result.value! - min) / (max - min) * 96 }))
}
