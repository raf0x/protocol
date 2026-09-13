import type { PdfLine, PdfSpan } from './labPdfParser'

/** Cluster actual baselines rather than rounding to fixed buckets. Small font
 * differences can offset range labels on the same visual row. Keep geometry. */
export function groupPdfTextRows(spans: PdfSpan[], page: number): PdfLine[] {
  const rows: { y: number; height: number; spans: PdfSpan[] }[] = []
  for (const span of [...spans].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!span.text.trim() || ![span.x, span.y, span.width, span.height].every(Number.isFinite)) continue
    const previous = rows.at(-1)
    const tolerance = Math.min(2.5, Math.max(0.5, Math.min(previous?.height ?? span.height, span.height) * 0.3))
    if (previous && Math.abs(previous.y - span.y) <= tolerance) previous.spans.push(span)
    else rows.push({ y: span.y, height: span.height, spans: [span] })
  }
  return rows.map(row => {
    const ordered = row.spans.sort((a, b) => a.x - b.x)
    return { page, y: row.y, height: row.height, spans: ordered, text: ordered.map(span => span.text).join(' ').trim() }
  })
}

/** Local embedded-text extraction only. Never renders pages or invokes OCR. */
export async function extractPdfText(data: Uint8Array): Promise<PdfLine[]> {
  if(data.byteLength>10_000_000)throw new Error('Use a PDF under 10 MB.')
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
  if(typeof window!=='undefined')pdfjs.GlobalWorkerOptions.workerSrc=`/vendor/pdf.worker-${pdfjs.version}.min.mjs`
  const resources=typeof window!=='undefined'?{standardFontDataUrl:`/vendor/pdfjs-${pdfjs.version}/standard_fonts/`,cMapUrl:`/vendor/pdfjs-${pdfjs.version}/cmaps/`,cMapPacked:true}:{}
  const task=pdfjs.getDocument({data,useWasm:false,disableFontFace:true,useSystemFonts:false,...resources})
  let expired=false
  const timer=setTimeout(()=>{expired=true;void task.destroy()},30_000)
  try {
    const pdf=await task.promise
    if(pdf.numPages>50)throw new Error('Use a report with at most 50 pages. Split larger files first.')
    const lines:PdfLine[]=[];let chars=0
    for(let p=1;p<=pdf.numPages;p++) {
      const page=await pdf.getPage(p),content=await page.getTextContent()
      const spans: PdfSpan[] = content.items.flatMap(item => 'str' in item && item.str.trim() ? [{ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height }] : [])
      for (const line of groupPdfTextRows(spans, p)) {
        chars += line.text.length
        if (chars > 200_000 || lines.length >= 10_000) throw new Error('This PDF has too much text. Split it into smaller reports.')
        lines.push(line)
      }
      page.cleanup()
    }
    if(!lines.some(line=>line.text.length>3))throw new Error('This PDF appears to be scanned. Text extraction is not available for this file yet.')
    return lines
  }catch(error) {
    if(expired)throw new Error('PDF extraction timed out. Try a smaller file or CSV.')
    if(error instanceof Error && /^(Use a|This PDF)/.test(error.message))throw error
    throw new Error('This PDF could not be read. It may be damaged or password-protected. Try an unlocked text PDF or CSV.')
  }finally{clearTimeout(timer);await task.destroy()}
}
