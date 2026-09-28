// Focused local browser regression for the real ring component and CSS.
// Run: node tests/protocol-rings.browser.cjs (Chrome installed on Windows).
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')
const cp = require('child_process')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const root = process.cwd()
const cache = new Map()
function resolveLocal(specifier, importer) {
  const base = path.resolve(path.dirname(importer), specifier)
  for (const candidate of [base, base + '.ts', base + '.tsx', base + '.js']) if (fs.existsSync(candidate)) return candidate
  throw Error(`Cannot resolve ${specifier} from ${importer}`)
}
function load(file) {
  file = path.resolve(file)
  if (cache.has(file)) return cache.get(file)
  const loadedModule = { exports: {} }
  cache.set(file, loadedModule.exports)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(specifier => specifier.startsWith('.') ? load(resolveLocal(specifier, file)) : require(specifier), loadedModule, loadedModule.exports)
  cache.set(file, loadedModule.exports)
  return loadedModule.exports
}

const Rings = load(path.join(root, 'components/protocols/ProtocolRingComposition.tsx')).default
const counts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]
const cases = counts.map(count => `<section data-count="${count}">${renderToStaticMarkup(React.createElement(Rings, {
  items: Array.from({ length: count }, (_, index) => ({ id: `c${index}`, name: `Protocol ${index}`, week: index + 1 })),
  selected: 'c0',
  onSelect() {},
}))}</section>`).join('')
const css = fs.readFileSync(path.join(root, 'app/protocol/manage/protocols.css'), 'utf8')
const checks = String.raw`
try {
  const results=[];
  for(const section of document.querySelectorAll('section[data-count]')) {
    const count=Number(section.dataset.count),rings=[...section.querySelectorAll('button.protocol-ring-named')],composition=section.querySelector('.protocol-ring-composition');
    if(rings.length!==count)throw Error('Named count '+count);
    if(new Set(rings.map(ring=>ring.getAttribute('aria-label'))).size!==count)throw Error('Unique names '+count);
    if(!rings.every((ring,index)=>ring.getAttribute('aria-label').startsWith('Protocol '+index+',')))throw Error('Stable order '+count);
    rings.forEach((ring,index)=>{const row=Math.floor(index/3),indexInRow=index%3,rowSize=Math.min(3,count-row*3),column=rowSize===1?3:rowSize===2?2+indexInRow*2:1+indexInRow*2,style=getComputedStyle(ring);if(Number(style.gridColumnStart)!==column||Number(style.gridRowStart)!==row+1)throw Error('Placement '+index+'/'+count)});
    const finalRow=rings.slice(Math.floor((count-1)/3)*3),first=finalRow[0].getBoundingClientRect(),last=finalRow.at(-1).getBoundingClientRect(),box=composition.getBoundingClientRect();
    if(Math.abs((first.left+last.right)/2-(box.left+box.right)/2)>2)throw Error('Final row centering '+count);
    if(composition.scrollWidth>composition.clientWidth)throw Error('Composition overflow '+count);
    if(!rings.every(ring=>{const rect=ring.getBoundingClientRect();return rect.width>=80&&rect.height>=80&&rect.left>=box.left-1&&rect.right<=box.right+1&&rect.top>=box.top-1&&rect.bottom<=box.bottom+1}))throw Error('Clipped ring '+count);
    results.push({count,rows:Math.ceil(count/3),height:box.height});
  }
  if(document.documentElement.scrollWidth>innerWidth)throw Error('Page overflow');
  document.title='QA:'+btoa(JSON.stringify(results));
} catch(error) { document.title='FAIL:'+btoa(error.message); }
`
const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>:root{--app-text:#f8fafc;--app-secondary:#a7b0c0;--app-surface:#101827;--app-bg:#07101f}*{box-sizing:border-box}body{margin:0;padding:16px;background:var(--app-bg)}section{margin-bottom:24px}${css}</style></head><body>${cases}<script>${checks}</script></body></html>`

const fixture = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'protocol-rings-browser-')), 'fixture.html')
fs.writeFileSync(fixture, html)
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const results = []
for (const width of [320, 375, 390, 1024]) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `protocol-rings-${width}-`))
  const run = cp.spawnSync(chrome, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, `--window-size=${width},844`, '--virtual-time-budget=1000', '--dump-dom', pathToFileURL(fixture).href,
  ], { encoding: 'utf8', windowsHide: true, timeout: 30000 })
  if (run.error) throw run.error
  const match = run.stdout.match(/<title>(QA|FAIL):([^<]+)<\/title>/)
  if (!match) throw Error(`No browser result at ${width}px: ${run.stderr}`)
  const payload = Buffer.from(match[2], 'base64').toString('utf8')
  if (match[1] === 'FAIL') throw Error(`${payload} at ${width}px`)
  results.push({ width, cases: JSON.parse(payload) })
}
console.log(JSON.stringify({ passed: true, viewportCount: results.length, caseCount: results.reduce((total, result) => total + result.cases.length, 0), results }, null, 2))
