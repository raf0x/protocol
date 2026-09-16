import type { LabDraft, LabDraftRow } from './labs'
import { extractLabDocument, type PdfLine } from './labPdfParser'
import { importParserVersion, parseReference, parseFlag, validateLabCandidate, reviewRepeatedCandidates } from './labImportValidation'
export { parseReference, parseFlag } from './labImportValidation'
export type { PdfLine } from './labPdfParser'

export const importFields = ['biomarker','value','unit','reference','low','high','status','date','provider','panel'] as const
export type ImportField = typeof importFields[number]
export type ColumnMap = Record<ImportField, number>
export type CsvTable = { headers: string[]; rows: string[][] }
const aliases: Record<ImportField,string[]> = {
  biomarker:['biomarker','biomarkername','test','testname','analyte','analytename','marker','name'], value:['result','value','resultvalue','testresult'],
  unit:['unit','units','resultunit','resultunits'],reference:['reference','referencerange','normalrange','range'],low:['low','referencelow','lowerlimit','lowerbound'],high:['high','referencehigh','upperlimit','upperbound'],
  status:['status','flag','resultflag','interpretation'],date:['date','testdate','collectiondate','collecteddate'],provider:['provider','lab','labname','laboratory'],panel:['panel','panelname'],
}
export function detectColumns(headers: string[]): ColumnMap {
  return Object.fromEntries(importFields.map(field => [field,headers.findIndex(header => aliases[field].includes(header.toLowerCase().replace(/[^a-z0-9]/g,'')))])) as ColumnMap
}

/** Quoted fields, escaped quotes, CRLF, embedded newlines, BOM, tab/semicolon CSV. */
export function parseCsv(text: string): CsvTable {
  if (text.length > 2_000_000) throw new Error('CSV is too large. Split it into files under 2 MB.')
  text=text.replace(/^\uFEFF/,'')
  const counts: Record<string,number>={',':0,';':0,'\t':0}; let quoted=false
  for(let i=0;i<text.length;i++) { const c=text[i]; if(c==='"') { if(quoted && text[i+1]==='"')i++;else quoted=!quoted } else if(!quoted) { if(c==='\n'||c==='\r')break;if(c in counts)counts[c]++ } }
  const delimiter=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]
  const records:string[][]=[];let row:string[]=[],cell='';quoted=false;let closed=false
  for(let i=0;i<text.length;i++) {
    const c=text[i]
    if(quoted) { if(c==='"') { if(text[i+1]==='"'){cell+='"';i++}else{quoted=false;closed=true} }else cell+=c;continue }
    if(c==='"') { if(cell||closed)throw new Error('CSV contains an unexpected quote. Check the file formatting.');quoted=true }
    else if(c===delimiter){row.push(cell);cell='';closed=false}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);records.push(row);row=[];cell='';closed=false}
    else if(closed && c.trim())throw new Error('CSV contains text after a closing quote. Check the file formatting.')
    else if(!closed)cell+=c
  }
  if(quoted)throw new Error('CSV has an unclosed quoted field.')
  if(cell||row.length){row.push(cell);records.push(row)}
  const nonempty=records.filter(r=>r.some(c=>c.trim()))
  if(nonempty.length<2)throw new Error('This CSV needs a header and at least one result row.')
  if(nonempty.length>501 || nonempty[0].length>100)throw new Error('Use at most 500 result rows and 100 columns per file.')
  return {headers:nonempty[0],rows:nonempty.slice(1)}
}
function safeDate(raw: string) {
  const normalized=raw.trim().replace(/^(\d{4})\/(\d{2})\/(\d{2})$/,'$1-$2-$3')
  const date=new Date(`${normalized}T12:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized)&&Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===normalized?normalized:''
}
export function mapCsv(table: CsvTable, map: ColumnMap, filename: string): LabDraft {
  if(map.biomarker<0||map.value<0)throw new Error('Map the biomarker name and result columns before continuing.')
  const used=Object.values(map).filter(i=>i>=0)
  if(new Set(used).size!==used.length)throw new Error('Each CSV column can map to only one field.')
  const get=(row:string[],field:ImportField)=>(row[map[field]]??'').trim()
  const dates=new Set(table.rows.map(row=>get(row,'date')).filter(Boolean))
  const providers=new Set(table.rows.map(row=>get(row,'provider')).filter(Boolean))
  const panels=new Set(table.rows.map(row=>get(row,'panel')).filter(Boolean))
  const test_date=dates.size===1?safeDate([...dates][0]):''
  return {test_date,panel_name:panels.size===1?[...panels][0]:'',provider:providers.size===1?[...providers][0]:'',notes:'',source_type:'csv',source_filename:filename,
    source_metadata:{parser:'csv-v2',validator:importParserVersion,mapping:map,headers:table.headers,original_dates:[...dates],row_count:table.rows.length},
    results:reviewRepeatedCandidates(table.rows.map((cells,index)=>{
      const flag=parseFlag(get(cells,'status')),range=parseReference(get(cells,'reference')),warnings:string[]=[]
      if(flag.warning)warnings.push(flag.warning)
      if(cells.length!==table.headers.length)warnings.push('Column count differs from the header.')
      if(!get(cells,'biomarker')||!get(cells,'value'))warnings.push('Name or result is missing.')
      if(!test_date)warnings.push('Confirm the test date. Imported dates are missing, ambiguous, or differ across rows.')
      if(providers.size>1||panels.size>1)warnings.push('This file includes multiple panels or providers. Exclude unrelated rows before saving one panel.')
      const low=get(cells,'low'),high=get(cells,'high')
      const validBound=(s:string)=>!s||/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)
      if(!validBound(low)||!validBound(high))warnings.push('A reference bound is nonnumeric; it was kept as reference text.')
      const row: LabDraftRow = {biomarker_name:get(cells,'biomarker'),entry:get(cells,'value'),unit:get(cells,'unit'),...range,
        reference_low:validBound(low)?low||range.reference_low:'',reference_high:validBound(high)?high||range.reference_high:'',
        reference_text:[range.reference_text,!validBound(low)?`Low: ${low}`:'',!validBound(high)?`High: ${high}`:''].filter(Boolean).join(' · '),status:flag.status,included:true,
        source_row_index:index+2,source_raw:{headers:table.headers,cells},import_confidence:!get(cells,'value')||!get(cells,'biomarker')||cells.length!==table.headers.length?'low':warnings.length?'medium':'high',warnings}
      const validated = validateLabCandidate({ name: row.biomarker_name, entry: row.entry, unit: row.unit, reference: row.reference_text,
        low: row.reference_low, high: row.reference_high, flag: get(cells, 'status'), explicitUnit: map.unit >= 0,
        source: { row: index + 2, headers: table.headers, cells }, evidence: ['mapped_columns'], reasons: warnings,
        collectionDate: safeDate(get(cells, 'date')) || undefined })
      return validated ?? { ...row, included: false, import_confidence: 'low' as const,
        warnings: [...warnings, 'This row could not be validated. Correct it before choosing Include.'] }
    }))}
}

export type PdfAdapter = {id:string; matches:(lines:PdfLine[])=>boolean; parse:(lines:PdfLine[])=>LabDraftRow[]}
export function parsePdfLines(lines: PdfLine[], filename: string, adapters: PdfAdapter[] = []): LabDraft {
  if (!lines.some(line => line.text.trim().length > 3)) throw new Error('This PDF appears to be scanned. Text extraction is not available for this file yet.')
  if (lines.length > 10_000 || lines.reduce((size, line) => size + line.text.length, 0) > 200_000) throw new Error('This PDF has too much text. Split it into smaller reports.')
  const extracted = extractLabDocument(lines)
  let rows = extracted.rows, parser = importParserVersion
  for (const adapter of adapters) {
    try {
      if (!adapter.matches(lines)) continue
      const validated = adapter.parse(lines).map(row => validateLabCandidate({ name: row.biomarker_name, entry: row.entry, unit: row.unit,
        reference: row.reference_text, low: row.reference_low, high: row.reference_high, flag: row.status,
        source: { row: row.source_row_index ?? 1, ...(row.source_raw ?? {}) }, evidence: ['adapter'], explicitUnit: true,
        reasons: ['Adapter extraction. Verify the original source before including.'] })).filter((row): row is LabDraftRow => row !== null)
      if (validated.length) { rows = reviewRepeatedCandidates(validated); parser = adapter.id; break }
    } catch { /* Unsupported adapter layout uses the same validated local fallback. */ }
  }
  if (!rows.length) throw new Error("We couldn't detect lab results in this file. Try CSV or manual entry. Scanned PDFs require OCR, which is not available yet.")
  if (rows.length > 500) throw new Error('More than 500 candidate rows were found. Split this report into smaller files.')
  const metadata = extracted.metadata
  return { test_date: metadata.collection_dates.length === 1 ? metadata.collection_dates[0] : '', panel_name: '', provider: metadata.provider ?? '', notes: '',
    source_type: 'pdf', source_filename: filename,
    // Preserve analyte-only evidence. Never persist the entire extracted document,
    // which may include patient IDs, addresses and administrative details.
    source_metadata: { parser, line_count: lines.length, ...metadata, candidate_count: rows.length,
      included_count: rows.filter(row => row.included).length, review_count: rows.filter(row => !row.included).length }, results: rows }
}

/** Sanitized classification only -- never the parsed biomarker names, values, or
 * document content. Fixed slugs, not the raw thrown message, so a later copy edit
 * never changes what gets logged and no unanticipated message text can leak
 * through this boundary. Order matters: more specific patterns are checked first. */
const importErrorRules: [RegExp, string][] = [
  // Narrowed to the exact scanned-PDF message, not a bare /scanned/ match --
  // the "no rows detected" message below also mentions "Scanned PDFs" in
  // passing and would otherwise be misclassified as the wrong failure mode.
  [/appears to be scanned/i, 'pdf_scanned'],
  [/timed out/i, 'pdf_timeout'],
  [/damaged or password-protected/i, 'pdf_unreadable'],
  [/at most \d+ pages/i, 'pdf_too_many_pages'],
  [/too much text/i, 'pdf_too_much_text'],
  [/couldn.t detect lab results/i, 'pdf_no_rows_detected'],
  [/candidate rows were found/i, 'pdf_too_many_rows'],
  [/CSV is too large/i, 'csv_too_large'],
  [/unexpected quote|closing quote|unclosed quoted field/i, 'csv_quote_error'],
  [/header and at least one result row/i, 'csv_missing_rows'],
  [/result rows and \d+ columns/i, 'csv_too_many_rows'],
  [/map the biomarker name/i, 'csv_mapping_incomplete'],
  [/can map to only one field/i, 'csv_mapping_duplicate'],
  [/could not be decoded/i, 'decode_failed'],
  [/under \d+ MB/i, 'file_too_large'],
  [/^Choose a \./i, 'wrong_extension'],
]
export function classifyImportError(message: string): string {
  return importErrorRules.find(([pattern]) => pattern.test(message))?.[1] ?? 'unclassified'
}
