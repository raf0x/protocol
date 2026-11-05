// Local-only QA of the actual Today page, shell, rings, snapshot and non-blocking check-in panel.
// Includes Today Performance V1A fault, recovery, race and render-timing checks.
// Supabase is replaced at the module boundary. No real account/data/network writes.
// Artwork (PowerShell): $env:TODAY_ARTWORK_ONLY='1'; npm run validate:browser -- tests/today-v2.browser.cjs; Remove-Item Env:TODAY_ARTWORK_ONLY
// Full regression: npm run validate:browser -- tests/today-v2.browser.cjs
// Presentation (PowerShell): $env:TODAY_PRESENTATION_ONLY='1'; npm run validate:browser -- tests/today-v2.browser.cjs; Remove-Item Env:TODAY_PRESENTATION_ONLY
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const cp = require('node:child_process'), http = require('node:http'), ts = require('typescript')
const sha256 = text => require('node:crypto').createHash('sha256').update(text).digest('hex')
const sourceHashes = { 'tests/recorded-dose.browser.cjs': sha256(fs.readFileSync(__filename)) }

/** Protected action tile: medication provenance without review or recovery UI. */
function installProtectedFocusChecks() {
  window.qaProtectedFocus = (scenario, allowSaveError = false) => {
    const focus = document.getElementById('focus-title').closest('section')
    const expected = scenario === 'medication' ? '4.50e-3 mg' : 'Not recorded'
    const doseAmount = focus.querySelector('[class$="_doseAmount"]')
    if (scenario === 'legacy') {
      check(!doseAmount && focus.innerText.includes('No doses scheduled today'), 'Focus preserves the empty schedule for ambiguous legacy records excluded by the existing scheduling gate')
    } else {
      check(doseAmount?.textContent === expected, 'Focus preserves explicit medication or neutral missing label: ' + scenario + ', expected ' + expected + ', actual ' + doseAmount?.textContent)
    }
    check(!focus.querySelector('details,summary,[class*="warning"],[class*="badge"],[class*="Review"],[class*="diagnostic"]'), 'Focus contains no diagnostic disclosure, warning or badge: ' + scenario)
    check(!/review|vial|reconstitution|concentration|calculated|recorded markings|origin unverified|syringe|injection volume/i.test(focus.innerText), 'Focus contains no recovery or calculated-dose explanation: ' + scenario)
    check(focus.querySelectorAll('[role="alert"]').length === (allowSaveError ? 1 : 0), 'Focus only shows the existing failed-save alert when saving fails: ' + scenario)
    check(focus.querySelector('a[href="/protocol/manage"]'), 'Focus retains manage navigation: ' + scenario)
    const markTaken = [...focus.querySelectorAll('button')].find(button => button.textContent === 'Mark taken')
    if (scenario === 'legacy') {
      check(!markTaken && !focus.querySelector('progress'), 'Focus does not invent a scheduled action or progress for ambiguous legacy records')
    } else {
      check(markTaken && !markTaken.disabled, 'Focus retains the available Mark taken action: ' + scenario)
      check(focus.querySelector('progress')?.max === 2, 'Focus retains scheduled progress: ' + scenario)
    }
    return focus
  }
}

/** Browser-only assertions: resolved colors, conservative gradient stops and actual text bounds. */
function installPresentationChecks() {
  const context = document.createElement('canvas').getContext('2d', { willReadFrequently: true }), colors = new Map()
  let backgrounds = new WeakMap()
  const color = value => {
    if (!colors.has(value)) {
      if (!CSS.supports('color', value)) throw Error('Unsupported computed color: ' + value)
      context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1)
      const pixel = [...context.getImageData(0, 0, 1, 1).data]; colors.set(value, [...pixel.slice(0, 3), pixel[3] / 255])
    }
    return colors.get(value)
  }
  const blend = (front, back) => [...front.slice(0, 3).map((value, i) => value * front[3] + back[i] * (1 - front[3])), 1]
  const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
  const surfaces = element => {
    if (!element) return [[255, 255, 255, 1]]
    if (backgrounds.has(element)) return backgrounds.get(element)
    const style = getComputedStyle(element), base = surfaces(element.parentElement).map(back => blend(color(style.backgroundColor), back))
    const stops = style.backgroundImage === 'none' ? [] : style.backgroundImage.match(/(?:rgba?|color)\([^)]*\)|#[\da-f]{3,8}\b|transparent/gi)
    if (style.backgroundImage !== 'none' && !stops?.length) throw Error('Unsupported computed background: ' + style.backgroundImage)
    const values = stops?.length ? base.flatMap(back => stops.map(stop => blend(color(stop), back))) : base
    backgrounds.set(element, values); return values
  }
  window.qaPresentationCache = () => { backgrounds = new WeakMap() }
  window.qaTextContrast = (element, label) => {
    const style = getComputedStyle(element), foreground = color(style.color)
    const minimum = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700) ? 3 : 4.5
    const ratio = Math.min(...surfaces(element).map(back => contrast(blend(foreground, back), back)))
    check(ratio >= minimum, label + ' text contrast ' + ratio.toFixed(2) + ': ' + element.textContent.trim().slice(0, 70) + ' (' + style.color + ')')
  }
  window.qaTextBounds = (element, label) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node; (node = walker.nextNode());) {
      if (!node.textContent.trim() || node.parentElement.closest('svg,[aria-hidden="true"]')) continue
      const clampedRing = node.parentElement.closest('.protocol-ring-name')
      if (clampedRing) {
        const ring = clampedRing.closest('button.protocol-ring-named'), style = getComputedStyle(clampedRing), name = clampedRing.textContent
        check(style.webkitLineClamp === '2' && style.overflowY === 'hidden', label + ' existing two-line ring label contract')
        check(ring?.title === name && ring.getAttribute('aria-label')?.startsWith(name + ','), label + ' full ring name remains accessible')
      }
      const range = document.createRange(); range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue
        check(rect.left >= -1 && rect.right <= innerWidth + 1, label + ' text inside page: ' + node.textContent.trim().slice(0, 45))
        let scrollableY = false
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          const style = getComputedStyle(parent), box = parent.getBoundingClientRect()
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) check(rect.left >= box.left - 1 && rect.right <= box.right + 1, label + ' text not horizontally clipped: ' + JSON.stringify({text:node.textContent.trim(),element:node.parentElement.className,ancestor:parent.className,overflow:style.overflowX,textBox:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},ancestorBox:{left:box.left,right:box.right,top:box.top,bottom:box.bottom}}))
          if (['auto', 'scroll'].includes(style.overflowY) && parent.scrollHeight > parent.clientHeight) scrollableY = true
          if (!scrollableY && parent !== clampedRing && ['hidden', 'clip'].includes(style.overflowY)) check(rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1, label + ' text not vertically clipped: ' + JSON.stringify({text:node.textContent.trim(),element:node.parentElement.className,ancestor:parent.className,overflow:style.overflowY,textBox:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},ancestorBox:{left:box.left,right:box.right,top:box.top,bottom:box.bottom}}))
        }
      }
    }
  }
  window.qaPrepareTab = target => {
    const controls = [...document.querySelectorAll('a[href],button,input,textarea,select,[tabindex]')].filter(e => e.tabIndex >= 0 && !e.matches(':disabled') && e.getClientRects().length && getComputedStyle(e).visibility === 'visible')
    const index = controls.indexOf(target); check(index > 0, 'Keyboard predecessor exists')
    window.qaFocusTarget = target; controls[index - 1].focus()
  }
  window.qaVisibleFocus = label => {
    const target = qaFocusTarget, style = getComputedStyle(target)
    check(document.activeElement === target && target.matches(':focus-visible'), label + ' real Tab reaches visible focus')
    check(parseFloat(style.outlineWidth) >= 2 && !['none', 'hidden'].includes(style.outlineStyle), label + ' focus outline is visible')
    check(Math.min(...surfaces(target.parentElement).map(back => contrast(blend(color(style.outlineColor), back), back))) >= 3, label + ' focus outline contrast')
    const box = target.getBoundingClientRect(), spread = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset)
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      const clipping = getComputedStyle(parent), bounds = parent.getBoundingClientRect()
      if (['hidden', 'clip'].includes(clipping.overflowX)) check(box.left - spread >= bounds.left - 1 && box.right + spread <= bounds.right + 1, label + ' focus outline not clipped horizontally')
      if (['hidden', 'clip'].includes(clipping.overflowY)) check(box.top - spread >= bounds.top - 1 && box.bottom + spread <= bounds.bottom + 1, label + ' focus outline not clipped vertically')
    }
  }
}

const WebSocket = require('next/dist/compiled/ws')
const root = process.cwd(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpp019-browser-'))
const evidence = path.resolve(process.env.R4B2B_BROWSER_EVIDENCE || '../MyPepProtocol-Recorded-Dose-R4B2B-Evidence/browser');fs.mkdirSync(evidence,{recursive:true});
const entry = path.join(dir, 'fixture.tsx')
sourceHashes['app/protocol/today-v2.module.css'] = sha256(fs.readFileSync(path.join(root, 'app/protocol/today-v2.module.css')))
sourceHashes['components/today/TodaysFocusCard.tsx'] = sha256(fs.readFileSync(path.join(root, 'components/today/TodaysFocusCard.tsx')))
console.log('Today browser artifacts: ' + dir)
const baselineDir = process.env.TODAY_BASELINE_DIR
const performanceOnly = process.env.TODAY_PERFORMANCE_ONLY === '1' || Boolean(baselineDir)
const scheduleOnly = process.env.TODAY_SCHEDULE_ONLY === '1'
const presentationOnly = process.env.TODAY_PRESENTATION_ONLY === '1'
const artworkOnly = process.env.TODAY_ARTWORK_ONLY === '1'
const recoveryOnly = process.env.TODAY_RECOVERY_ONLY === '1'
let chrome, ws, server
const deadline = setTimeout(() => { console.error('Today fixture exceeded 120 seconds'); process.exit(1) }, 120000)
fs.writeFileSync(entry, `
import React from ${JSON.stringify(path.join(root, 'node_modules/react'))};
import {createRoot} from ${JSON.stringify(path.join(root, 'node_modules/react-dom/client'))};
import Page from ${JSON.stringify(path.join(root, 'app/protocol/page.tsx'))};
import Shell from ${JSON.stringify(path.join(root, 'components/app/AppShell.tsx'))};
import {entryFromForm} from ${JSON.stringify(path.join(root, 'lib/health/dosingEntry.ts'))};
const NativeDate=Date;
window.qaNow='2026-10-04T12:00:00';
window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[qaNow]))}static now(){return new NativeDate(qaNow).getTime()}};
window.qaCount=5; window.qaMode='full'; window.qaLogs=[]; window.qaWrites=[]; window.qaFailSave=false; window.qaNavigated=''; window.qaUnit='lbs';window.qaPolicy={};window.qaRequests=[];window.qaAuthListeners=new Set();window.qaUserId='qa-owner';window.qaJournal=null;
window.qaEmitAuth=(event,userId)=>{qaUserId=userId;for(const listener of qaAuthListeners)listener(event,userId?{user:{id:userId}}:null)};
window.qaProtocols=()=>Array.from({length:qaCount},(_,i)=>({id:'p'+i,created_at:'2026-09-01',name:'Protocol '+i,status:'active',start_date:'2026-09-01',compounds:[{id:'c'+i,name:i===4?'A very long compound name that stays fully readable in its row':['Tirzepatide','GHK-Cu','BPC-157','CJC-1295'][i%4],vial_strength:10,vial_unit:'mg',bac_water_ml:2,ml_per_dose:.2,vials_in_stock:2,doses_taken_override:0,phases:[{id:'phase'+i,dose:5,dose_unit:'mg',dose_semantics_version:i===3?null:1,frequency:'daily',time_of_day:'Morning',start_week:1,end_week:null}]}]}));
const originalProtocols=qaProtocols;
window.qaProtocols=()=>{const rows=originalProtocols();if(qaMode==='history')rows[0].start_date='2020-01-01';if(qaMode==='focus'){const compound=rows[0].compounds[0];compound.name='HGH';Object.assign(compound.phases[0],{dose:1,dose_unit:'IU',time_of_day:'night',dosing_entry:entryFromForm({input_mode:'medication',dose:'1',dose_unit:'IU',injection_volume:'.5',preparation:'ready',concentration_value:'20',concentration_unit:'IU/mL',reviewed:true})})}return rows};
window.qaEntries=()=>qaJournal??(qaMode==='empty'||qaMode==='missing'?[]:[{id:'j1',date:'2026-10-04',weight:180,energy:3,mood:4,hunger:null,sleep:0,notes:''},{id:'j2',date:'2026-09-01',weight:182,energy:2,mood:3,sleep:7,notes:''}]);
window.qaRouter={push:url=>{qaNavigated=url},replace:url=>{qaNavigated=url},refresh:()=>{}};
function Fixture(){const [version,setVersion]=React.useState(0);React.useEffect(()=>{window.qaReset=(count=5,mode='full',policy={},options={})=>{qaCount=count;qaMode=mode;qaLogs=options.logs??[];qaWrites=[];qaFailSave=false;qaNavigated='';qaUnit='lbs';qaPolicy=policy;qaRequests=[];qaJournal=null;qaNow='2026-10-04T12:00:00';qaUserId=options.userId??'qa-owner';if(!options.onboarding)sessionStorage.setItem('mpp:first-protocol:'+qaUserId,'1');window.qaMountedAt=performance.now();setVersion(v=>v+1)}},[]);return <Shell><Page key={version}/></Shell>}
sessionStorage.setItem('mpp:first-protocol:qa-owner','1');
createRoot(document.getElementById('root')).render(<Fixture/>);
`)

let fixture=fs.readFileSync(entry,'utf8');
fixture += fs.readFileSync(path.join(root,'tests/recorded-dose.fixture.txt'),'utf8').replaceAll('__ROOT__',root.replaceAll('\\','/'));
fixture=fixture.replace(/function Fixture\(\)\{[^\n]+/, "function Fixture(){const [state,setState]=React.useState({view:'today',version:0});React.useEffect(()=>{window.qaShow=(view,mode)=>{qaCase=mode;qaLogs=[];qaWrites=[];qaActions=[];qaRequests=[];setState(s=>({view,version:s.version+1}))}},[]);return <Shell>{state.view==='detail'?<div className='protocols-page'><Detail protocol={qaProtocols()[0]} today='2026-10-04' onBack={()=>qaActions.push('back')} onEdit={()=>qaActions.push('edit')} onComplete={()=>qaActions.push('complete')} onPause={()=>qaActions.push('pause')} onResume={()=>qaActions.push('resume')} onReactivate={()=>qaActions.push('reactivate')} onDelete={()=>qaActions.push('delete')} onReload={()=>qaActions.push('reload')}/></div>:state.view==='editor'?<Manage key={state.version}/>:<Page key={state.version}/>}</Shell>}");
fs.writeFileSync(entry,fixture);
require.extensions['.ts'] = () => {}; require.extensions['.tsx'] = () => {}
const modules = [], ids = new Map(), styles = [], globalStyles = []
function bundle(file) {
  file = require.resolve(file)
  if (ids.has(file)) return ids.get(file)
  const id = modules.length; ids.set(file, id); modules.push(null)
  let code = fs.readFileSync(file, 'utf8')
  // Only these production modules are replaced, without writing a baseline into the repository.
  if (baselineDir && ['app/protocol/page.tsx', 'components/today/TodayOverview.tsx'].some(relative => file === path.join(root, relative))) code = fs.readFileSync(path.join(baselineDir, path.relative(root, file)), 'utf8')
  for (const relative of ['app/protocol/page.tsx', 'components/today/TodayOverview.tsx', 'components/dashboard/WeeklySchedule.tsx', 'components/dashboard/HeroProtocolCard.tsx', 'components/today/SelectedProtocolSnapshot.tsx', 'components/today/EnhancedVial.tsx', 'components/today/EnhancedScheduleArtwork.tsx', 'components/today/enhanced-artwork.module.css']) if (file === path.join(root, relative)) sourceHashes[relative] = sha256(code)
  if (file === path.join(root, 'lib/supabase.ts')) code = `
  async function response(key,result,signal){
    const policy={...(qaPolicy[key]??{})};const record={key,started:performance.now(),completed:null,aborted:false};qaRequests.push(record);
    await new Promise((resolve,reject)=>{let timer;const abort=()=>{record.aborted=true;if(policy.ignoreAbort)return;clearTimeout(timer);record.completed=performance.now();reject(Object.assign(Error('Fixture request aborted'),{name:'AbortError'}))};if(signal?.aborted)abort();else{signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve()},policy.delay??0)}});
    record.completed=performance.now();return policy.fail?{data:key==='auth'?{user:null}:null,error:{message:'Fictional request failure',name:policy.errorName??'AuthRetryableFetchError',status:503}}:policy.result??result;
  }
  exports.createClient=()=>({auth:{getUser:()=>response('auth',{data:{user:qaUserId?{id:qaUserId}:null},error:null}),onAuthStateChange:callback=>{qaAuthListeners.add(callback);return {data:{subscription:{unsubscribe:()=>qaAuthListeners.delete(callback)}}}}},from:table=>{
    let filters={},single=false,columns='',write=null,signal;
    const q={select(c){columns=c;return this},eq(k,v){filters[k]=v;return this},order(){return this},in(){return this},gte(){return this},lte(){return this},range(){return this},limit(){return this},single(){single=true;return this},maybeSingle(){single=true;return this},abortSignal(value){signal=value;return this},upsert(value){write=value;return this},update(value){write=value;return this},then(resolve,reject){return Promise.resolve().then(async()=>{
      if(window.qaMode==='loading')await new Promise(r=>setTimeout(r,1500));
      if(write){qaWrites.push({table,value:write,filters:{...filters}});if(qaFailSave)return {data:null,error:{message:'Fixture failed save'}};if(table==='user_profiles')qaUnit=write.weight_unit;if(table==='journal_entries'){const rows=qaEntries();qaJournal=[{...rows.find(e=>e.date===write.date),...write},...rows.filter(e=>e.date!==write.date)]}if(table==='injection_logs'){qaLogs=qaLogs.filter(l=>l.compound_id!==write.compound_id||l.date!==write.date);qaLogs.push(write)}return response('write:'+table,{data:table==='user_profiles'&&columns?{weight_unit:qaUnit}:null,error:null},signal)}
      const key=table==='protocols'?(filters.status==='active'?'active':filters.status==='planned'?'planned':columns==='id'?'ownership':'protocol-detail'):table==='injection_logs'?(filters.date?'today':'history'):table==='journal_entries'?'journal':table==='user_profiles'?'profile':table;
      if(qaMode==='error'&&table==='journal_entries')return response(key,{data:null,error:{message:'Fixture load failed'}},signal);
      let rows=table==='protocols'?qaProtocols():table==='journal_entries'?qaEntries():table==='injection_logs'?qaLogs:table==='protocol_events'&&qaMode!=='empty'?Array.from({length:4},(_,i)=>({id:'e'+i,date:'2026-10-0'+(4-i),event_type:'started',protocol_id:'p'+i,compound_id:'c'+i,description:null})):[];
      if(table==='user_profiles')return response(key,{data:{weight_unit:qaUnit},error:null},signal);
      if(table==='compounds')return response(key,{data:{vials_in_stock:2,doses_taken_override:0},error:null},signal);
      for(const [key,value] of Object.entries(filters))if(key!=='user_id')rows=rows.filter(row=>row[key]===value);
      return response(key,{data:single?rows[0]||null:rows,error:null},signal)
    }).then(resolve,reject)}};return q}});`
  if (file === path.join(root, 'lib/health/dosingEntry.ts')) code=code.replace('export function interpretEntry(entry: DosingEntry) {', 'export function interpretEntry(entry: DosingEntry) { throw Error("Forbidden interpreter call in recording UI");');
  const relative=path.relative(root,file).replaceAll('\\','/');if(!relative.startsWith('..')&&!relative.startsWith('node_modules'))sourceHashes[relative]=sha256(fs.readFileSync(file));
  // PWA registration is unrelated and must not install a fixture service worker.
  if (file === path.join(root, 'components/app/PwaLifecycle.tsx')) code = 'exports.__esModule=true;exports.default=()=>null;'
  if (file === require.resolve('next/navigation')) code = "exports.useRouter=()=>qaRouter;exports.usePathname=()=>'/protocol';exports.useSearchParams=()=>new URLSearchParams(location.search);"
  if (file === require.resolve('next/link')) code = "const React=require('react');exports.__esModule=true;exports.default=({prefetch,onClick,...props})=>React.createElement('a',{...props,onClick:e=>{e.preventDefault();qaNavigated=props.href;onClick?.(e)}});"
  if (file.endsWith('.module.css')) {
    const names = {}, globals = []
    let css = code.replace(/:global\(([^)]+)\)/g, (_, value) => 'GLOBALTOKEN' + (globals.push(value) - 1))
    css = css.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => '.' + (names[name] = 'm' + id + '_' + name))
    styles.push(css.replace(/GLOBALTOKEN(\d+)/g, (_, i) => globals[i])); code = 'module.exports=' + JSON.stringify(names)
  } else if (file.endsWith('.css')) { globalStyles.push(code); code = 'module.exports={}' }
  if (/\.(tsx?|m?js)$/.test(file)) code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const map = {}
  for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const dep = JSON.parse('"' + match[1] + '"')
    if (require('node:module').isBuiltin(dep)) throw Error('Unexpected browser builtin: ' + dep)
    map[dep] = bundle(require.resolve(dep, { paths: [path.dirname(file), root] }))
  }
  modules[id] = `function(module,exports){const require=name=>load(${JSON.stringify(map)}[name]);${code}\n}`
  return id
}
const id = bundle(entry)
const js = `const process={env:{NODE_ENV:'production'}};const modules=[${modules.join(',')}],cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports);return module.exports}load(${id});`
const css = ['app/globals.css', 'app/mobile-app.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n') + '\n' + globalStyles.join('\n') + '\n' + styles.join('\n')
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody{margin:0;font-family:Inter,Arial,sans-serif}</style><div id="root"></div><script>window.errors=[];window.onerror=(...args)=>errors.push(args.slice(0,3));window.onunhandledrejection=e=>errors.push(String(e.reason));window.fetch=()=>{throw Error('Unexpected real fetch')};</script><script>${js.replaceAll('</script', '<\\/script')}</script></html>`

fs.writeFileSync(path.join(evidence,'fixture.html'),html);
;(async () => {
  server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  console.log('Fixture bundled; launching Chrome')
  chrome = cp.spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(dir, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let port = ''
  for (let i = 0; i < 100; i++) {
    try { port = fs.readFileSync(path.join(dir, 'profile/DevToolsActivePort'), 'utf8'); if (port.includes('/devtools/')) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!port) throw Error('Chrome did not start')
  const targets = await (await fetch('http://127.0.0.1:' + port.split('\n')[0] + '/json', { signal: AbortSignal.timeout(10000) })).json()
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  console.log('Chrome connected')
  let seq = 0; const pending = new Map()
  ws.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const job = pending.get(message.id); if (!job) return; clearTimeout(job.timer); pending.delete(message.id); message.error ? job.reject(message.error) : job.resolve(message.result) } }
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)) }, 45000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })) })
  const run = async code => { const result = await cdp('Runtime.evaluate', { expression: '(async()=>{' + code + '})()', awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
  const viewport = (width, height = 844) => cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
  const press = async (key, code, value) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: value, ...(type === 'keyDown' && key === 'Enter' ? { text: '\r' } : {}) }) }
  const screenshots = [], presentationMatrix = []
  const screen = async name => { const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(evidence, name + '.png'); fs.writeFileSync(file, Buffer.from(shot.data, 'base64')); screenshots.push(file) }
  await viewport(390);
  await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  await cdp('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/protocol'});
  await new Promise(r=>setTimeout(r,900));
  await run(`window.checks=[];window.check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};window.tick=()=>new Promise(r=>setTimeout(r,180));window.button=label=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===label);window.waitFor=async f=>{for(let i=0;i<60;i++){if(f())return;await new Promise(r=>setTimeout(r,50))}throw Error('UI readiness timeout '+document.body.innerText.slice(0,300))};check(errors.length===0,'No initial runtime errors '+JSON.stringify(errors));`);
  await run('('+installPresentationChecks.toString()+')()');
  await run('('+installProtectedFocusChecks.toString()+')()');
  for(const theme of ['dark','light']) for(const width of [320,390]) {
    await viewport(width,width===320?568:844);
    for(const scenario of ['syringe','medication','missing','legacy','volume']) {
      await run(`document.documentElement.dataset.theme=${JSON.stringify(theme)};qaShow('today',${JSON.stringify(scenario)});await waitFor(()=>document.querySelector('.today-protocol-snapshot'));await tick();window.scrollTo(0,0);check(errors.length===0,'Today runtime errors');check(qaWrites.length===0,'Rendering never writes');check(document.documentElement.scrollWidth<=innerWidth,'Today fits ${width}');`);
      await run(`qaProtectedFocus(${JSON.stringify(scenario)});`);
      await screen(`today-${scenario}-${theme}-${width}-initial`);
      await run(`window.card=document.querySelector('.today-protocol-snapshot');check(!card.innerText.includes('4 mg')&&!card.innerText.includes('0.4 mL'),'No calculated equivalent in Active Compound');check(card.querySelector('svg'),'Premium vial artwork retained');card.scrollIntoView({block:'start'});await tick();qaPresentationCache();for(const el of card.querySelectorAll('h3,p,dt,dd')){qaTextBounds(el,'Active Compound');qaTextContrast(el,'Active Compound')};`);
      if(scenario==='medication')await run("check(card.innerText.includes('4.50e-3 mg'),'Raw scientific medication visible')");
      if(scenario==='syringe')await run("check(card.innerText.includes('40 recorded markings'),'Recorded markings visible');check(!card.innerText.includes('4 mg'),'No derived medication')");
      if(scenario==='legacy')await run("check(card.innerText.includes('origin unverified'),'Legacy source remains unverified')");
      await screen(`active-${scenario}-${theme}-${width}`);
      if(scenario==='syringe'){
        await run("button('+ New Vial').click();await tick();check(document.querySelector('dialog[open]')?.innerText.includes('temporarily unavailable'),'New Vial remains restricted');check(qaWrites.length===0,'New Vial changes no stock/history/counters');check(document.querySelector('dialog').contains(document.activeElement),'Dialog focus contained');button('Close').click();await tick();check(document.activeElement.textContent==='+ New Vial','Dialog returns focus');");
        await run("qaProtectedFocus('syringe').scrollIntoView({block:'start'});await tick();");
        await screen(`focus-${theme}-${width}`);
        await run("const next=qaProtectedFocus('syringe').querySelector('[aria-label=\"View next dose today\"]');check(next&&!next.disabled,'Next scheduled dose navigation remains');next.click();await tick();check(qaProtectedFocus('syringe').innerText.includes('Synthetic compound 1'),'Next scheduled identity correct');qaFailSave=true;button('Mark taken').click();await waitFor(()=>document.getElementById('focus-title').closest('section').querySelector('[role=\"alert\"]'));await tick();const focus=qaProtectedFocus('syringe',true);check(focus.querySelector('[role=\"alert\"]').textContent.includes('wasn')&&focus.querySelector('[role=\"alert\"]').textContent.includes('saved'),'Existing save failure remains visible');check(focus.innerText.includes('Synthetic compound 1'),'Failed save preserves selected dose for retry');check(focus.querySelector('progress').value===0&&qaLogs.length===0,'Failed save does not complete the scheduled action');check(qaWrites.length===1&&qaWrites[0].table==='injection_logs','Failed save attempts only the existing injection log write');");
        await screen(`focus-save-error-${theme}-${width}`);
        await run("qaFailSave=false;button('Mark taken').click();await waitFor(()=>qaWrites.some(w=>w.table==='compounds'));await tick();check(qaWrites.length===3,'Retry adds only the existing log and counter writes');const log=qaWrites.filter(w=>w.table==='injection_logs').at(-1);check(log.value.compound_id==='c1'&&log.value.taken===true,'Retry marks the selected compound taken');check(JSON.stringify(Object.keys(log.value).sort())===JSON.stringify(['compound_id','date','discomfort','taken','user_id']),'Injection payload fields unchanged');check(!qaWrites.some(w=>['protocols','phases'].includes(w.table)),'No phase/history mutation');const focus=qaProtectedFocus('syringe');check(focus.querySelector('progress').value===1,'Successful retry advances scheduled progress');check(focus.innerText.includes('Synthetic compound 0'),'Successful retry advances to the remaining scheduled dose');check(!focus.querySelector('[role=\"alert\"]'),'Successful retry clears the existing save error');");
      }
    }
    await run("qaShow('detail','syringe');await waitFor(()=>document.querySelector('.protocol-detail'));await tick();window.scrollTo(0,0);check(document.body.innerText.includes('40 recorded markings'),'Detail recorded markings');check(button('Edit protocol'),'Edit lifecycle action');check(document.documentElement.scrollWidth<=innerWidth,'Detail fits viewport');check(qaWrites.length===0,'Detail performs no writes');");
    await screen(`detail-${theme}-${width}-initial`);
    await run("[...document.querySelectorAll('summary')].find(e=>e.textContent==='Protocol actions').click();await tick();check(button('Pause protocol')&&button('Complete protocol'),'Detail lifecycle actions retained');button('Pause protocol').click();check(qaActions.includes('pause'),'Pause callback remains available');check(qaWrites.length===0,'Presentation fixture never performs lifecycle mutation');");
    await run("qaShow('editor','syringe');await waitFor(()=>document.querySelector('.protocols-page'));await tick();window.editButton=[...document.querySelectorAll('button')].find(e=>/Edit|View/.test(e.textContent));");
    await run("const title=[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes('Synthetic compound 0')||e.textContent.includes('Synthetic plan 0'));check(title,'Protocol list navigation');title.click();await tick();if(button('Edit protocol'))button('Edit protocol').click();await waitFor(()=>document.querySelector('.protocol-editor'));await tick();window.scrollTo(0,0);check(qaWrites.length===0,'Opening editor never writes');check(!document.body.innerText.includes('4 mg')&&!document.body.innerText.includes('≈'),'Editor contains no equivalents');check(document.documentElement.scrollWidth<=innerWidth,'Editor fits viewport');");
    await screen(`editor-${theme}-${width}-initial`);
    await run("const more=[...document.querySelectorAll('summary')].find(e=>e.textContent==='More options');if(more)more.click();await tick();const vial=button('Vial')||[...document.querySelectorAll('button')].find(e=>e.textContent.startsWith('Vial'));if(vial)vial.click();await tick();const review=[...document.querySelectorAll('summary')].find(e=>e.textContent==='Review recorded facts');if(review){review.click();review.scrollIntoView({block:'center'});}await tick();check(qaWrites.length===0,'Review changes no persistence');check(!document.body.innerText.includes('Calculated medication'),'No calculated review row');");
    await screen(`editor-review-${theme}-${width}`);
  }
  const report={passed:true,assertionCount:await run('return checks.length'),checks:await run('return checks'),screenshots,sourceHashes,errors:await run('return errors'),scope:'Actual production React pages/components with module-boundary synthetic Supabase, interpreter call trap and blocked fetch. Chrome mobile emulation, not physical Safari/VoiceOver.'};
  fs.writeFileSync(path.join(evidence,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,assertions:report.assertionCount,screenshots:screenshots.length}));
})().catch(error=>{fs.writeFileSync(path.join(evidence,'browser-failure.txt'),String(error.stack||error));console.error(error);process.exitCode=1}).finally(()=>{ws?.close();chrome?.kill();server?.close();clearTimeout(deadline)});
