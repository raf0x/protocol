import { classifyBiomarker } from './biomarkerIntelligence'
import type { LabDraftRow, LabStatus } from './labs'

export const importParserVersion = 'lab-import-intelligence-v1'
export const resultNumber = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?'
const numeric = new RegExp(`^${resultNumber}$`, 'i')
export const qualitativeResult = '(?:not detected|non[- ]reactive|negative|positive|detected|reactive|trace)'
export type ImportConfidence = 'high' | 'medium' | 'low'
export type CandidateEvidence = 'table_columns' | 'labelled_result' | 'inline_unit' | 'attached_range' | 'adjacent_result' | 'mapped_columns' | 'adapter'
export type LabImportCandidate = {
  name: string; entry: string; unit: string; reference: string; low?: string; high?: string; flag: string
  source: { page?: number; row: number; text?: string; lines?: { page: number; row: number; text: string }[]; headers?: string[]; cells?: string[] }
  evidence: CandidateEvidence[]; reasons?: string[]; collectionDate?: string; reportDate?: string; panel?: string
  /** A dedicated mapped/labelled column can contain an unfamiliar unit. Free prose cannot. */
  explicitUnit?: boolean
}

export function parseReference(text: string) {
  const n = `(${resultNumber})`
  const range = text.trim().match(new RegExp(`^${n}\\s*(?:-|–|−|to)\\s*${n}$`, 'i'))
  if (range && Number.isFinite(Number(range[1])) && Number.isFinite(Number(range[2])) && Number(range[1]) <= Number(range[2]))
    return { reference_low: range[1], reference_high: range[2], reference_text: text }
  const one = text.trim().match(new RegExp(`^(<=|>=|≤|≥)\\s*${n}$`, 'i'))
  if (one && Number.isFinite(Number(one[2]))) return { reference_low: ['>=', '≥'].includes(one[1]) ? one[2] : '', reference_high: ['<=', '≤'].includes(one[1]) ? one[2] : '', reference_text: text }
  return { reference_low: '', reference_high: '', reference_text: text }
}
export function parseFlag(raw: string): { status: LabStatus | ''; warning?: string } {
  const mapping: Record<string, LabStatus> = { h: 'high', high: 'high', l: 'low', low: 'low', n: 'normal', normal: 'normal', a: 'abnormal', abnormal: 'abnormal', unknown: 'unknown' }
  const flag = raw.trim().toLowerCase()
  return !flag ? { status: '' } : mapping[flag] ? { status: mapping[flag] } : { status: '', warning: 'Unrecognized printed flag. Confirm its meaning from the report.' }
}

/** Shape validation, not unit conversion or a medical ontology. Keep source spelling. */
export function measurementUnitKind(raw: string): 'known' | 'unknown' | 'invalid' | 'missing' {
  const unit = raw.trim()
  if (!unit) return 'missing'
  if (/^(?:reference|range|newbrook|ortega|quest|(?:LC|GC|HPLC)[/-]MS(?:[/-]MS)?)$/i.test(unit)) return 'invalid'
  if (/^(?:%|SD|IU|U|fL|pg|ng|mg|mcg|µg|μg|g|mL|dL|L|mmol|mmHg|mOsm|ratio|index|score|titer|seconds?|sec|s|mm\/hr)$/i.test(unit)) return 'known'
  if (/^(?:[a-zµμ]+|(?:\d+(?:\^\d+)?|10[*^]\d+)\s*[a-zµμ]*)(?:\/(?:[a-zµμ]+|\d+(?:\.\d+)?m2))+(?:\/\d+(?:\.\d+)?m2)?$/i.test(unit)) return 'known'
  // Dedicated columns may contain an uncommon source unit; require human review.
  if (unit.length <= 80 && /^[a-z0-9µμ%/^*(). +−-]+$/i.test(unit) && !/https?:|@/i.test(unit)) return 'unknown'
  return 'invalid'
}

/** Supplement row structure with a small vocabulary of document regions. */
export function documentRegion(text: string): 'range' | 'header' | 'administrative' | 'paragraph' | null {
  if (/^(?:reference(?:\s+(?:range|interval))?|normal range)\s*:/i.test(text)) return 'range'
  if (/^(?:analyte|biomarker|test(?:\s+name)?)\s+(?:result|value|units?)(?:\s|$)/i.test(text) || /^(?:result|value|units?|reference range|flag)$/i.test(text)) return 'header'
  if (/\b(?:DOB|patient\s*(?:ID|name)|specimen|requisition|client\s*#|lab reference ID|collected|received|reported|collection date|report date|report status|fasting)\s*[:#]/i.test(text)) return 'administrative'
  if (/^(?:(?:patient|account|name|age|sex|gender|phone|fax|address|provider|laboratory|lab|date)\s*[:#]|performing (?:sites?|lab)\b|laboratory director\b|key$)/i.test(text)) return 'administrative'
  if (/https?:\/\/|www\.|\b(?:copyright|all rights reserved|privacy policy|laboratory director)\b|©|\b\d{3}[-.) ]+\d{3}[- ]\d{4}\b/i.test(text)) return 'administrative'
  if (/\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/.test(text) || /\b\d+\s+[\w ]+\s(?:street|st|road|rd|drive|dr|avenue|ave|highway|hwy|lane|ln|blvd)\b/i.test(text)) return 'administrative'
  if (/^(?:page\s*)?\d+\s*(?:\/|of)\s*\d+(?:\s|$)/i.test(text)) return 'administrative'
  if (/^(?:this|these|for additional|for more|please|it has|it is|has been|not been|the |to the |and |characteristics |educational |purposes|administration\.|viewed as|rights reserved)/i.test(text) || /\b(?:FDA|CLIA|disclaimer)\b/i.test(text)) return 'paragraph'
  return null
}
export function plausibleAnalyte(name: string) {
  return name.length >= 2 && name.length <= 200 && /^[a-zµμ]/i.test(name) && name.split(/\s+/).length <= 16 && !documentRegion(name) && !/[{};=]|\b(?:has|have|was|were|please|your)\b/i.test(name)
}

export function validateLabCandidate(candidate: LabImportCandidate): LabDraftRow | null {
  const name = candidate.name.trim(), entry = candidate.entry.trim(), unit = candidate.unit.trim()
  if (!plausibleAnalyte(name) || !entry || entry.length > 200) return null
  if (!Number.isInteger(candidate.source.row) || candidate.source.row < 1) return null
  if (candidate.source.page != null && (!Number.isInteger(candidate.source.page) || candidate.source.page < 1)) return null
  if (candidate.source.lines?.some(line => line.page !== candidate.source.page || !Number.isInteger(line.row) || line.row < 1)) return null
  if ((candidate.source.text?.length ?? 0) > 6000 || candidate.reference.length > 1000) return null
  if (/^[+-]?(?:nan|infinity)$/i.test(entry) || (numeric.test(entry) && !Number.isFinite(Number(entry)))) return null
  const isNumeric = numeric.test(entry)
  const isQualified = new RegExp(`^(?:[<>]=?|[≤≥])\\s*${resultNumber}$`, 'i').test(entry)
  const isQualitative = new RegExp(`^${qualitativeResult}$`, 'i').test(entry)
  const mapped = candidate.evidence.includes('mapped_columns')
  if (!isNumeric && !isQualified && !isQualitative && !mapped) return null
  if (isQualified && !Number.isFinite(Number(entry.replace(/^[<>≤≥=]+\s*/, '')))) return null
  const unitKind = measurementUnitKind(unit)
  if (unitKind === 'invalid' || (unitKind === 'unknown' && !candidate.explicitUnit)) return null
  const mapping = classifyBiomarker(name)
  const reasons = [...(candidate.reasons ?? [])]
  if (mapped && !isNumeric && !isQualified && !isQualitative) reasons.push('Unrecognized result text. Confirm it against the source before including.')
  const range = parseReference(candidate.reference)
  const low = candidate.low?.trim() || range.reference_low, high = candidate.high?.trim() || range.reference_high
  const validBound = (s: string) => !s || numeric.test(s) && Number.isFinite(Number(s))
  const boundsValid = validBound(low) && validBound(high) && !(low && high && Number(low) > Number(high))
  if (!boundsValid || candidate.reference && !range.reference_low && !range.reference_high && /\d/.test(candidate.reference)) reasons.push('Reference range needs review; no numeric bounds were assumed.')
  if (unitKind === 'unknown') reasons.push('Unfamiliar unit in the source column. Confirm its spelling.')
  if (unitKind === 'missing' && isNumeric) reasons.push('Unit not supplied. Confirm whether this result needs one.')
  if (isQualified) reasons.push('Result includes a comparison sign; preserved as report text.')
  if (!candidate.collectionDate) reasons.push('Confirm the collection date before saving.')
  const flag = parseFlag(candidate.flag)
  if (flag.warning) reasons.push(flag.warning)
  const strong = mapped || candidate.evidence.includes('table_columns') || candidate.evidence.includes('labelled_result') || candidate.evidence.includes('attached_range')
  if (!strong && mapping.key.startsWith('raw:')) reasons.push('Unlabelled result layout. Check the name and value against the source.')
  // Missing panel date alone does not weaken a well-grounded analyte extraction.
  const uncertainty = reasons.filter(reason => !reason.startsWith('Confirm the collection date'))
  const confidence: ImportConfidence = !strong && unitKind === 'missing' ? 'low' : uncertainty.length ? 'medium' : 'high'
  const fields = { biomarker_name: name, entry, unit, reference_low: boundsValid ? low : '', reference_high: boundsValid ? high : '', reference_text: candidate.reference, status: flag.status }
  return { ...fields, included: confidence === 'high', import_confidence: confidence, warnings: [...new Set(reasons)], source_row_index: candidate.source.row,
    source_raw: { ...candidate.source, extraction: { parser: importParserVersion, canonical_identity: mapping.key, evidence: candidate.evidence,
      confidence_reasons: [...new Set(reasons)], auto_include: confidence === 'high', review_required: confidence !== 'high',
      printed_flag: candidate.flag || null, numeric_result: isNumeric ? Number(entry) : null, qualitative_result: isNumeric ? null : entry,
      collection_date: candidate.collectionDate ?? null, report_date: candidate.reportDate ?? null, panel: candidate.panel ?? null, fields } } }
}

/** Retain every occurrence and source. Equality is not proof of duplicate assays. */
export function reviewRepeatedCandidates(rows: LabDraftRow[]): LabDraftRow[] {
  const groups = new Map<string, LabDraftRow[]>()
  for (const row of rows) {
    const key = classifyBiomarker(row.biomarker_name).key
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group)
  }
  return rows.map(row => {
    const group = groups.get(classifyBiomarker(row.biomarker_name).key)!
    if (group.length < 2) return row
    const equal = group.every(other => other.entry === row.entry && other.unit === row.unit && other.reference_text === row.reference_text && other.status === row.status)
    const reason = equal ? 'Repeated analyte. Review each source occurrence before including it.' : 'Multiple results for this analyte. Check dates, units and source rows before including them.'
    const extraction = row.source_raw?.extraction as Record<string, unknown> | undefined
    return { ...row, included: false, import_confidence: 'medium', warnings: [...(row.warnings ?? []), reason], source_raw: row.source_raw && { ...row.source_raw,
      extraction: { ...extraction, auto_include: false, review_required: true, confidence_reasons: [...(row.warnings ?? []), reason] } } }
  })
}
