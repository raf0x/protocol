import { unzipSync, strFromU8 } from 'fflate'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { INVENTORY_HEADERS, MAX_FILE_BYTES, MAX_ROWS, type InputRow } from './model'

type Node = Record<string, unknown>
const list = (v: unknown): Node[] => v == null ? [] : (Array.isArray(v) ? v : [v]) as Node[]
const obj = (v: unknown): Node => v && typeof v === 'object' ? v as Node : {}
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, (_, entity: string) => {
  const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  if (entity[0] !== '#') return named[entity] ?? ''
  const code = entity[1] === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
})
const text = (v: unknown): string => typeof v === 'string' ? decode(v) : typeof v === 'number' ? String(v) : v && typeof v === 'object' ? text(obj(v)['#text']) : ''
function rich(v: unknown): string { const n = obj(v); return n.t !== undefined ? text(n.t) : list(n.r).map(r => text(r.t)).join('') }

/** Bounded, values-only OOXML reader. No formula evaluation, links, or file writes. */
export function readInventoryWorkbook(bytes: Uint8Array, filename: string): InputRow[] {
  if (!/\.xlsx$/i.test(filename)) throw new Error('Choose an .xlsx file.')
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) throw new Error('Choose an .xlsx file up to 2 MB.')
  let files: Record<string, Uint8Array>, expanded = 0, entries = 0
  const names = new Set<string>()
  try {
    files = unzipSync(bytes, { filter(file) {
      if (++entries > 100 || file.originalSize > 4_000_000 || (expanded += file.originalSize) > 10_000_000) throw new Error('Workbook is too large when expanded.')
      if (names.has(file.name) || file.name.includes('..') || /vbaproject|\.bin$|externalLinks\//i.test(file.name)) throw new Error('Workbook contains unsupported content.')
      names.add(file.name)
      return /\.xml$|\.rels$/.test(file.name)
    } })
  } catch { throw new Error('Workbook is damaged, too large when expanded, or contains macros/external content. Use the supplied .xlsx template.') }
  const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, parseAttributeValue: false, trimValues: false, processEntities: false })
  function xml(path: string): Node {
    if (!files[path]) throw new Error('Workbook is missing a required worksheet or metadata file.')
    const raw = strFromU8(files[path])
    if (/<!DOCTYPE|<!ENTITY|macroEnabled/i.test(raw) || XMLValidator.validate(raw) !== true) throw new Error('Workbook XML is unsupported or damaged.')
    return parser.parse(raw) as Node
  }
  xml('[Content_Types].xml')
  const book = obj(xml('xl/workbook.xml').workbook), sheets = list(obj(book.sheets).sheet)
  if (sheets.length !== 1 || sheets[0]['@_name'] !== 'Inventory') throw new Error('Use one worksheet named Inventory, as in the template.')
  const rels = list(obj(xml('xl/_rels/workbook.xml.rels').Relationships).Relationship)
  const rel = rels.find(r => r['@_Id'] === sheets[0]['@_id'])
  if (!rel || rel['@_TargetMode'] === 'External') throw new Error('The Inventory worksheet is unavailable.')
  const target = String(rel['@_Target'] ?? ''), path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  if (!/^xl\/worksheets\/[^/]+\.xml$/.test(path)) throw new Error('Unsupported worksheet path.')
  const strings = files['xl/sharedStrings.xml'] ? list(obj(xml('xl/sharedStrings.xml').sst).si).map(rich) : []
  const date1904 = ['1', 'true'].includes(String(obj(book.workbookPr)['@_date1904']))
  const sheet = obj(xml(path).worksheet), rawRows = list(obj(sheet.sheetData).row)
  if (rawRows.length > MAX_ROWS + 20) throw new Error(`Import at most ${MAX_ROWS} item rows.`)
  let headers: string[] | null = null
  const output: InputRow[] = [], usedRows = new Set<number>()
  for (const rawRow of rawRows) {
    const rowNumber = Number(rawRow['@_r'])
    if (!Number.isInteger(rowNumber) || rowNumber < 1 || rowNumber > MAX_ROWS + 20 || usedRows.has(rowNumber)) throw new Error('Worksheet row positions exceed the template limits or repeat.')
    usedRows.add(rowNumber)
    const values: unknown[] = [], errors: string[] = [], usedCells = new Set<number>()
    for (const cell of list(rawRow.c)) {
      const ref = String(cell['@_r']), match = /^([A-Z]+)(\d+)$/.exec(ref)
      if (!match || Number(match[2]) !== rowNumber) throw new Error('Invalid cell address.')
      const col = [...match[1]].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1
      if (col >= INVENTORY_HEADERS.length || usedCells.has(col)) throw new Error('Use only the template columns, with no repeated cells.')
      usedCells.add(col)
      if ('f' in cell) errors.push(`${ref}: formulas are not accepted; replace with a value.`)
      if (cell['@_t'] === 'e' || cell['@_t'] === 'b') errors.push(`${ref}: enter a text, number or date value.`)
      const raw = text(cell.v), type = cell['@_t']
      let v: unknown = type === 's' ? strings[Number(raw)] : type === 'inlineStr' ? rich(cell.is) : raw
      if (type === 's' && v === undefined) errors.push(`${ref}: invalid shared string.`)
      if (headers?.[col]?.endsWith('_date') && raw && (!type || type === 'n')) {
        const serial = Number(raw)
        if (!Number.isInteger(serial) || serial < 1 || serial > 2_958_465 || (!date1904 && serial === 60)) errors.push(`${ref}: invalid Excel date.`)
        else v = new Date(Date.UTC(date1904 ? 1904 : 1899, date1904 ? 0 : 11, date1904 ? 1 : 30) + (serial + (!date1904 && serial < 60 ? 1 : 0)) * 86400000).toISOString().slice(0, 10)
      }
      values[col] = v ?? ''
    }
    if (!headers) {
      if (values.includes('item_name')) {
        if (errors.length || values.length !== INVENTORY_HEADERS.length || INVENTORY_HEADERS.some(h => !values.includes(h)) || new Set(values).size !== INVENTORY_HEADERS.length) throw new Error('Keep all template headers unchanged, with no duplicate columns.')
        headers = values as string[]
      }
      continue
    }
    if (values.some(v => v !== '') || errors.length) output.push({ rowNumber, values: Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ''])), errors })
  }
  if (!headers) throw new Error('Template headers were not found. Download a fresh template.')
  return output
}
