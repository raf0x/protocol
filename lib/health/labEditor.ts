import { prepareLabDraft, type LabDraft, type LabDraftRow, type LabPanel } from './labs'

export function draftFromPanel(panel: LabPanel): LabDraft {
  return { test_date: panel.test_date, panel_name: panel.panel_name ?? '', provider: panel.provider ?? '', notes: panel.notes ?? '',
    results: panel.results.map(row => ({ id: row.id, biomarker_name: row.biomarker_name, entry: row.value != null ? String(row.value) : row.value_text ?? '', unit: row.unit,
      reference_low: row.reference_low == null ? '' : String(row.reference_low), reference_high: row.reference_high == null ? '' : String(row.reference_high), reference_text: row.reference_text ?? '', status: row.status_source === 'reported' ? row.status : '' })) }
}

export function prepareLabSubmission(draft: LabDraft, reviewConfirmed: boolean) {
  const selected = draft.results.filter(row => row.included !== false)
  const prepared = prepareLabDraft({ ...draft, results: selected })
  const imported = draft.source_type === 'csv' || draft.source_type === 'pdf'
  if (imported && !reviewConfirmed) throw new Error('Confirm the included imported rows before saving.')
  return { panel: { ...prepared.panel, source_type: draft.source_type ?? 'manual', source_filename: draft.source_filename ?? null, source_metadata: draft.source_metadata ?? null, review_confirmed: reviewConfirmed },
    results: prepared.results.map((row,index) => ({ ...row, id: selected[index].id ?? null, source_row_index: selected[index].source_row_index ?? null,
      source_raw: selected[index].source_raw ?? null, import_confidence: selected[index].import_confidence ?? null, review_confirmed: reviewConfirmed })) }
}

function duplicateKey(date: string, name: string, value: string, unit: string) {
  // Numeric spelling differences (12 vs 12.0) represent the same stored value.
  // Names, dates, text results and units still match exactly after trim.
  const raw=value.trim()
  const numeric=/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw)&&Number.isFinite(Number(raw))
  return JSON.stringify([date, name.trim(), numeric?String(Number(raw)):raw, unit.trim()])
}
export function duplicateRows(draft: LabDraft, panels: LabPanel[], excludePanelId?: string): Set<number> {
  const existing = new Set<string>()
  for (const panel of panels) if (panel.id !== excludePanelId) for (const result of panel.results) existing.add(duplicateKey(panel.test_date,result.biomarker_name,result.value == null ? result.value_text ?? '' : String(result.value),result.unit))
  const seen = new Map<string, number>()
  const matches = new Set<number>()
  draft.results.forEach((row: LabDraftRow,index) => {
    if (row.included === false) return
    const key = duplicateKey(draft.test_date,row.biomarker_name,row.entry,row.unit)
    if (existing.has(key)) matches.add(index)
    if (seen.has(key)) { matches.add(index); matches.add(seen.get(key)!) }
    else seen.set(key,index)
  })
  return matches
}
