import type { LabDraftRow } from './labs'
import { classifyBiomarker } from './biomarkerIntelligence'
import { documentRegion, measurementUnitKind, plausibleAnalyte, qualitativeResult, resultNumber, validateLabCandidate, reviewRepeatedCandidates, type LabImportCandidate, type CandidateEvidence } from './labImportValidation'

export type PdfSpan = { text: string; x: number; y: number; width: number; height: number }
export type PdfLine = { page: number; text: string; spans?: PdfSpan[]; y?: number; height?: number }
export type PdfImportMetadata = {
  collection_dates: string[]; report_dates: string[]; fasting: boolean | null; provider: string | null; report_status: string | null; warnings: string[]
}
const numberOrText = `((?:[<>]=?|[≤≥])?\\s*${resultNumber}|${qualitativeResult})`
const flagPattern = /^(H|L|A|N|HIGH|LOW|NORMAL|ABNORMAL)$/i
const rangePattern = new RegExp(`^(${resultNumber}\\s*(?:-|–|−|to)\\s*${resultNumber}|(?:[<>]=?|[≤≥])\\s*${resultNumber})(?:\\s+(.+))?$`, 'i')
const rangeLabel = /\b(?:reference(?:\s+(?:range|interval))?|normal range)\s*:\s*/i

/** Only labelled, calendar-valid dates. Do not use DOB, footer or print dates. */
function labelledDate(text: string, kind: 'collection' | 'report') {
  const label = kind === 'collection' ? '(?:collected|collection date|date collected)' : '(?:reported|report date|date reported)'
  const match = text.match(new RegExp(`\\b${label}\\s*:\\s*(\\d{4}[-/]\\d{2}[-/]\\d{2}|\\d{1,2}/\\d{1,2}/\\d{4})(?!\\d)`, 'i'))
  if (!match) return null
  const raw = match[1], parts = raw.split(/[-/]/)
  const iso = parts[0].length === 4 ? parts.join('-') : `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  const date = new Date(`${iso}T12:00:00Z`)
  return !iso.startsWith('0000') && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : ''
}
function documentMetadata(lines: PdfLine[]): PdfImportMetadata {
  const collected = new Set<string>(), reported = new Set<string>(), fasting = new Set<boolean>(), providers = new Set<string>(), statuses = new Set<string>(), warnings: string[] = []
  for (const line of lines) {
    const collection = labelledDate(line.text, 'collection'), report = labelledDate(line.text, 'report')
    if (collection) collected.add(collection)
    if (report) reported.add(report)
    if (collection === '' || report === '') warnings.push('A printed date could not be validated. Confirm the collection date.')
    const fast = line.text.match(/\bfasting\s*:\s*(yes|no|y|n)\b/i)
    if (fast) fasting.add(/^y/i.test(fast[1]))
    const provider = line.text.match(/^(?:source lab|laboratory|provider)\s*:\s*([^:]+)$/i)
    if (provider && provider[1].length < 150 && !/\d{3}|@|https?:/i.test(provider[1])) providers.add(provider[1].trim())
    // This is literal document metadata, never a branch in result extraction.
    for (const name of line.text.matchAll(/\b([A-Z][A-Za-z]+ Diagnostics)\b/g)) providers.add(name[1])
    const status = line.text.match(/\breport status\s*:\s*(final|preliminary|corrected|amended)\b/i)
    if (status) statuses.add(status[1].toLowerCase())
  }
  if (collected.size !== 1) warnings.push(collected.size ? 'Multiple collection dates found. Save only rows for the chosen test date; import other dates separately.' : 'Collection date not found. Enter it from your report.')
  if (providers.size > 1) warnings.push('Multiple laboratories found. Confirm the provider for this panel.')
  return { collection_dates: [...collected], report_dates: [...reported], fasting: fasting.size === 1 ? [...fasting][0] : null,
    provider: providers.size === 1 ? [...providers][0] : null, report_status: statuses.size === 1 ? [...statuses][0] : null, warnings: [...new Set(warnings)] }
}

type Tail = { unit: string; reference: string; flag: string; reasons: string[] }
function parseTail(raw: string): Tail | null {
  let text = raw.trim(), flag = ''
  const tokens = text.split(/\s+/).filter(Boolean)
  if (flagPattern.test(tokens[0] ?? '')) flag = tokens.shift()!
  if (flagPattern.test(tokens.at(-1) ?? '')) {
    const last = tokens.pop()!
    if (flag && flag.toLowerCase() !== last.toLowerCase()) return null
    flag = last
  }
  text = tokens.join(' ')
  let unit = '', reference = '', referenceUnit = ''
  const label = text.match(rangeLabel)
  let left = label ? text.slice(0, label.index).trim() : text
  const rangeText = label ? text.slice(label.index! + label[0].length).trim() : ''
  if (label) {
    const match = rangeText.match(rangePattern)
    reference = match ? match[1] : rangeText
    referenceUnit = match?.[2]?.trim() ?? ''
    if (referenceUnit && measurementUnitKind(referenceUnit) !== 'known') return null
  }
  if (left) {
    // Unit may be printed before an unlabelled range, or on its own.
    const parts = left.split(/\s+/)
    if (measurementUnitKind(parts[0]) === 'known') { unit = parts.shift()!; left = parts.join(' ') }
    if (left) {
      const range = left.match(rangePattern)
      if (!range || label) return null
      reference = range[1]; referenceUnit = range[2]?.trim() ?? ''
      if (referenceUnit && measurementUnitKind(referenceUnit) !== 'known') return null
    }
  }
  const reasons = unit && referenceUnit && unit !== referenceUnit ? ['Result and reference range use different units. Check the source.'] : []
  return { unit: unit || referenceUnit, reference: reasons.length ? `${reference} ${referenceUnit}` : reference, flag, reasons }
}
function sourceLine(line: PdfLine, index: number) { return { page: line.page, row: index + 1, text: line.text } }
function closeLines(a: PdfLine, b: PdfLine) {
  return a.page === b.page && (a.y == null || b.y == null || Math.abs(a.y - b.y) <= Math.max(a.height ?? 8, b.height ?? 8) * 2.5)
}
type Column = { field: 'name' | 'entry' | 'unit' | 'reference' | 'flag'; x: number }
function tableColumns(line: PdfLine): Column[] {
  const fields: Record<string, Column['field']> = { analyte: 'name', biomarker: 'name', test: 'name', 'test name': 'name', result: 'entry', value: 'entry', unit: 'unit', units: 'unit', range: 'reference', 'reference range': 'reference', flag: 'flag', status: 'flag' }
  const columns = (line.spans ?? []).flatMap(span => {
    const field = fields[span.text.trim().toLowerCase()]
    return field ? [{ field, x: span.x }] : []
  }).sort((a, b) => a.x - b.x)
  return columns.some(c => c.field === 'name') && columns.some(c => c.field === 'entry') ? columns : []
}
function columnCandidate(line: PdfLine, index: number, columns: Column[]): LabImportCandidate | null {
  if (!columns.length || !line.spans?.length) return null
  const cells = { name: '', entry: '', unit: '', reference: '', flag: '' }
  for (const span of line.spans) {
    // Header labels mark column starts; allow modest alignment offsets only.
    const column = [...columns].reverse().find(c => span.x >= c.x - 8)
    if (column) cells[column.field] = [cells[column.field], span.text].filter(Boolean).join(' ')
  }
  const result = cells.entry.trim().match(new RegExp(`^${numberOrText}(?:\\s+(H|L|A|N|HIGH|LOW|NORMAL|ABNORMAL))?$`, 'i'))
  if (!result || !plausibleAnalyte(cells.name)) return null
  return { ...cells, entry: result[1], flag: cells.flag || result[2] || '', explicitUnit: true,
    source: { page: line.page, row: index + 1, text: line.text, lines: [sourceLine(line, index)] }, evidence: ['table_columns'] }
}
function directCandidate(line: PdfLine, index: number, inTable: boolean, columns: Column[] = []): LabImportCandidate | null {
  const text = line.text.trim()
  const resultColumn = columns.find(column => column.field === 'entry')
  // A heading entirely within the name column has no result, even if its name
  // contains a number followed by an assay label such as LC/MS.
  if (resultColumn && line.spans?.length && line.spans.every(span => span.x + span.width < resultColumn.x - 16)) return null
  // A complete registered analyte name (e.g. IGF 1) is a heading, not IGF = 1.
  if (!classifyBiomarker(text).key.startsWith('raw:')) return null
  const resultLabel = text.match(/\s+(?:result|value)\s*:\s*/i)
  const referenceIndex = text.search(rangeLabel)
  const left = referenceIndex >= 0 ? text.slice(0, referenceIndex).trim() : text
  const suffix = referenceIndex >= 0 ? text.slice(referenceIndex) : ''
  // Examine complete result fields, not the first digit in an analyte name.
  const pattern = new RegExp(`\\s+${numberOrText}(?=\\s|$)`, 'gi')
  const possibilities = [...left.matchAll(pattern)].reverse()
  for (const match of possibilities) {
    const name = left.slice(0, match.index).replace(/\s+(?:result|value)\s*:\s*$/i, '').trim()
    if (!plausibleAnalyte(name)) continue
    const tail = parseTail([left.slice(match.index! + match[0].length), suffix].filter(Boolean).join(' '))
    if (!tail) continue
    const evidence: CandidateEvidence[] = []
    if (inTable) evidence.push('table_columns')
    if (resultLabel) evidence.push('labelled_result')
    if (tail.unit) evidence.push('inline_unit')
    if (tail.reference) evidence.push('attached_range')
    const known = !classifyBiomarker(name).key.startsWith('raw:')
    const qualitative = new RegExp(`^${qualitativeResult}$`, 'i').test(match[1])
    if (!evidence.length && !known && !qualitative) continue
    return { name, entry: match[1].trim(), ...tail, source: { page: line.page, row: index + 1, text: line.text, lines: [sourceLine(line, index)] }, evidence }
  }
  return null
}

/** One bounded pass over local document rows. No provider-specific parsing paths. */
export function extractLabDocument(lines: PdfLine[]) {
  const metadata = documentMetadata(lines), candidates: LabImportCandidate[] = []
  const ambiguousRangeRows = new Set<number>()
  let columns: Column[] = []
  let inTable = false, inSites = false, page = -1, collectionDate: string | undefined, panel: string | undefined
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index], text = line.text.trim()
    if (page !== line.page) { page = line.page; inTable = false; inSites = false; panel = undefined; columns = [] }
    const collected = labelledDate(text, 'collection')
    if (collected != null) collectionDate = collected || undefined
    if (/^performing (?:sites?|lab)/i.test(text)) { inSites = true; inTable = false; continue }
    const region = documentRegion(text)
    if (region === 'header') { if (/\b(?:analyte|biomarker|test)\b.*\b(?:value|result)\b/i.test(text)) { inTable = true; inSites = false; columns = tableColumns(line) }; continue }
    if (!text || inSites || region === 'administrative' || region === 'paragraph') continue
    if (region === 'range') continue // handled only as an attached continuation below
    let candidate = columnCandidate(line, index, columns) ?? directCandidate(line, index, inTable, columns)
    if (!candidate && plausibleAnalyte(text)) {
      const next = lines[index + 1]
      if (next && closeLines(line, next)) {
        const match = next.text.trim().match(new RegExp(`^(?:(?:result|value)\\s*:\\s*)?${numberOrText}(?=\\s|$)(.*)$`, 'i'))
        const tail = match && parseTail(match[2])
        if (match && tail && (inTable || tail.unit || tail.reference || !classifyBiomarker(text).key.startsWith('raw:') || /^(?:result|value)\s*:/i.test(next.text))) {
          candidate = { name: text, entry: match[1].trim(), ...tail, source: { page, row: index + 1, text: `${line.text}\n${next.text}`, lines: [sourceLine(line, index), sourceLine(next, index + 1)] },
            evidence: ['adjacent_result', ...(inTable ? ['table_columns' as const] : []), ...(tail.unit ? ['inline_unit' as const] : []), ...(tail.reference ? ['attached_range' as const] : [])] }
          index++
        }
      }
      if (!candidate && /\b(?:panel|profile)\b/i.test(text)) panel = text
    }
    if (!candidate) continue
    if (ambiguousRangeRows.has(candidate.source.row)) candidate.reasons = [...(candidate.reasons ?? []), 'A nearby detached range could belong to another result. No range was assumed.']
    const next = lines[index + 1]
    if (!candidate.reference && next && closeLines(lines[index], next) && documentRegion(next.text.trim()) === 'range') {
      const tail = parseTail(next.text)
      const following = lines[index + 2]
      const competing = following && closeLines(next, following) && !documentRegion(following.text.trim()) &&
        (directCandidate(following, index + 2, inTable) || plausibleAnalyte(following.text.trim()))
      if (tail && competing) {
        candidate.reasons = [...(candidate.reasons ?? []), 'A detached range sits between results. Confirm its association from the report.']
        candidate.source.lines!.push(sourceLine(next, index + 1))
        ambiguousRangeRows.add(index + 3)
      } else if (tail) {
        const incompatible = candidate.unit && tail.unit && candidate.unit !== tail.unit
        if (incompatible) candidate.reasons?.push('Result and reference range use different units. Check the source.')
        candidate.reference = incompatible ? `${tail.reference} ${tail.unit}` : tail.reference; candidate.unit ||= tail.unit
        candidate.source.lines!.push(sourceLine(next, index + 1)); candidate.source.text += `\n${next.text}`
        candidate.evidence.push('attached_range'); index++
      }
    }
    candidate.collectionDate = collectionDate ?? (metadata.collection_dates.length === 1 ? metadata.collection_dates[0] : undefined)
    candidate.reportDate = metadata.report_dates.length === 1 ? metadata.report_dates[0] : undefined
    candidate.panel = panel
    if (metadata.collection_dates.length > 1) candidate.reasons = [...(candidate.reasons ?? []), 'Multiple collection dates in this document. Confirm which panel this row belongs to.']
    candidates.push(candidate)
  }
  const rows = reviewRepeatedCandidates(candidates.map(validateLabCandidate).filter((row): row is LabDraftRow => row !== null))
  return { rows, metadata, rejected: candidates.length - rows.length }
}
