import type { LabDraft, LabDraftRow, LabStatus } from './labs'

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
export function parseReference(text: string) {
  const n='([+-]?(?:\\d+\\.?\\d*|\\.\\d+))'
  const range=text.trim().match(new RegExp(`^${n}\\s*(?:-|–|to)\\s*${n}$`,'i'))
  if(range && Number(range[1])<=Number(range[2]))return {reference_low:range[1],reference_high:range[2],reference_text:text}
  const one=text.trim().match(new RegExp(`^(<=|>=|≤|≥)\\s*${n}$`))
  if(one)return {reference_low:['>=','≥'].includes(one[1])?one[2]:'',reference_high:['<=','≤'].includes(one[1])?one[2]:'',reference_text:text}
  return {reference_low:'',reference_high:'',reference_text:text}
}
export function parseFlag(raw: string): {status: LabStatus | ''; warning?: string} {
  const mapping: Record<string,LabStatus>={h:'high',high:'high',l:'low',low:'low',n:'normal',normal:'normal',a:'abnormal',abnormal:'abnormal',unknown:'unknown'}
  const flag=raw.trim().toLowerCase()
  return !flag ? {status:''} : mapping[flag] ? {status:mapping[flag]} : {status:'',warning:`Unrecognized lab flag: ${raw}. Confirm its meaning from the report.`}
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
    source_metadata:{parser:'csv-v2',mapping:map,headers:table.headers,original_dates:[...dates],row_count:table.rows.length},
    results:table.rows.map((cells,index)=>{
      const flag=parseFlag(get(cells,'status')),range=parseReference(get(cells,'reference')),warnings:string[]=[]
      if(flag.warning)warnings.push(flag.warning)
      if(cells.length!==table.headers.length)warnings.push('Column count differs from the header.')
      if(!get(cells,'biomarker')||!get(cells,'value'))warnings.push('Name or result is missing.')
      if(!get(cells,'unit'))warnings.push('Unit not supplied. Confirm whether this result needs one.')
      if(!test_date)warnings.push('Confirm the test date. Imported dates are missing, ambiguous, or differ across rows.')
      if(providers.size>1||panels.size>1)warnings.push('This file includes multiple panels or providers. Exclude unrelated rows before saving one panel.')
      const low=get(cells,'low'),high=get(cells,'high')
      const validBound=(s:string)=>!s||/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(s)
      if(!validBound(low)||!validBound(high))warnings.push('A reference bound is nonnumeric; it was kept as reference text.')
      return {biomarker_name:get(cells,'biomarker'),entry:get(cells,'value'),unit:get(cells,'unit'),...range,
        reference_low:validBound(low)?low||range.reference_low:'',reference_high:validBound(high)?high||range.reference_high:'',
        reference_text:[range.reference_text,!validBound(low)?`Low: ${low}`:'',!validBound(high)?`High: ${high}`:''].filter(Boolean).join(' · '),status:flag.status,included:true,
        source_row_index:index+2,source_raw:{headers:table.headers,cells},import_confidence:!get(cells,'value')||!get(cells,'biomarker')||cells.length!==table.headers.length?'low':warnings.length?'medium':'high',warnings}
    })}
}

export type PdfLine = {page:number; text:string}
export type PdfAdapter = {id:string; matches:(lines:PdfLine[])=>boolean; parse:(lines:PdfLine[])=>LabDraftRow[]}
export function parsePdfLines(lines: PdfLine[], filename: string, adapters: PdfAdapter[]=[]): LabDraft {
  if(!lines.some(line=>line.text.trim().length>3))throw new Error('This PDF appears to be scanned. Text extraction is not available for this file yet.')
  let rows:LabDraftRow[]=[];let parser='generic-pdf-v2'
  for(const adapter of adapters) {
    try { if(adapter.matches(lines)) { const parsed=adapter.parse(lines);if(parsed.length){rows=parsed;parser=adapter.id;break} } }catch{ /* An adapter failing to recognize a layout falls back to generic review. */ }
  }
  if(!rows.length)lines.forEach((line,index)=>{
    const text=line.text.trim()
    if(/^(?:page\s+\d|(?:test|biomarker|analyte)\s+(?:result|value)|(?:date|collected|reported|dob|patient|account|specimen|reference|provider|laboratory)\s*:)/i.test(text))return
    const match=text.match(/^(.+?)\s+(([<>]=?\s*)?[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|not detected|non-reactive|negative|positive|detected)\s*(.*)$/i)
    if(!match||!/[a-z]/i.test(match[1]))return
    const tail=match[4].trim().split(/\s+/).filter(Boolean)
    let flag='';if(/^(H|L|A|N|high|low|normal|abnormal)$/i.test(tail[0]??''))flag=tail.shift()!
    if(/^(H|L|A|N|high|low|normal|abnormal)$/i.test(tail.at(-1)??''))flag=tail.pop()!
    // Only a clearly unit-like token is assigned as a unit. Remaining text is
    // preserved verbatim as reference text, not converted or medically inferred.
    const unit=/^(?:%|[a-zµμ]+(?:[/*^][a-z0-9µμ]+)+(?:[/*^][a-z0-9µμ]+)*|[a-zµμ]+)$/i.test(tail[0]??'')?tail.shift()!:''
    const reference=tail.join(' ')
    const ambiguous=/\d/.test(match[1])||!unit
    rows.push({biomarker_name:match[1].trim(),entry:match[2].trim(),unit,...parseReference(reference),status:parseFlag(flag).status,included:true,
      source_row_index:index+1,source_raw:{page:line.page,text:line.text},import_confidence:ambiguous?'low':'medium',
      warnings:[ambiguous?'Ambiguous layout. Check name, value, and unit against the source.':'Parsed from PDF text. Verify column alignment and missing results.']})
  })
  if(!rows.length)throw new Error("We couldn't detect lab results in this file. Try CSV or manual entry. Scanned PDFs require OCR, which is not available yet.")
  if(rows.length>500)throw new Error('More than 500 candidate rows were found. Split this report into smaller files.')
  return {test_date:'',panel_name:'',provider:'',notes:'',source_type:'pdf',source_filename:filename,
    source_metadata:{parser,line_count:lines.length,extracted_lines:lines},results:rows}
}
