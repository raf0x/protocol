import type { PdfLine } from './labImport'

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
      const buckets=new Map<number,{x:number;text:string}[]>()
      for(const item of content.items) {
        if(!('str' in item)||!item.str.trim())continue
        const y=Math.round(item.transform[5]/2)*2
        const bucket=buckets.get(y)??[];bucket.push({x:item.transform[4],text:item.str});buckets.set(y,bucket)
      }
      for(const [,items] of [...buckets].sort(([a],[b])=>b-a)) {
        const text=items.sort((a,b)=>a.x-b.x).map(item=>item.text).join(' ').trim()
        chars+=text.length
        if(chars>200_000||lines.length>=10_000)throw new Error('This PDF has too much text. Split it into smaller reports.')
        lines.push({page:p,text})
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
