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
const sourceHashes = { 'tests/today-v2.browser.cjs': sha256(fs.readFileSync(__filename)) }

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
const entry = path.join(dir, 'fixture.tsx')
sourceHashes['app/protocol/today-v2.module.css'] = sha256(fs.readFileSync(path.join(root, 'app/protocol/today-v2.module.css')))
console.log('Today browser artifacts: ' + dir)
const baselineDir = process.env.TODAY_BASELINE_DIR
const performanceOnly = process.env.TODAY_PERFORMANCE_ONLY === '1' || Boolean(baselineDir)
const scheduleOnly = process.env.TODAY_SCHEDULE_ONLY === '1'
const presentationOnly = process.env.TODAY_PRESENTATION_ONLY === '1'
const artworkOnly = process.env.TODAY_ARTWORK_ONLY === '1'
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
    const q={select(c){columns=c;return this},eq(k,v){filters[k]=v;return this},order(){return this},limit(){return this},single(){single=true;return this},maybeSingle(){single=true;return this},abortSignal(value){signal=value;return this},upsert(value){write=value;return this},update(value){write=value;return this},then(resolve,reject){return Promise.resolve().then(async()=>{
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
  const screen = async name => { const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(dir, name + '.png'); fs.writeFileSync(file, Buffer.from(shot.data, 'base64')); screenshots.push(file) }
  await viewport(390)
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/protocol' })
  console.log('Fixture page opened')
  await new Promise(resolve => setTimeout(resolve, 800))
  await run(`window.checks=[];window.check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};window.tick=()=>new Promise(r=>setTimeout(r,100));window.summary=label=>[...document.querySelectorAll('summary')].find(e=>e.textContent.startsWith(label));window.button=label=>[...document.querySelectorAll('button')].find(e=>e.textContent===label);check(errors.length===0,'No initial errors '+JSON.stringify(errors));check(document.querySelector('h1').textContent.includes('your day'),'Today renders');check(document.querySelector('main section').getAttribute('aria-labelledby')==='health-title','Health leads the paired summary');`)
  await run(`window.metrics={};window.waitFor=async(predicate,limit=1500)=>{const start=performance.now();while(!predicate()){if(performance.now()-start>limit)throw Error('Fixture condition timed out after '+limit+'ms');await new Promise(r=>setTimeout(r,20))}};window.criticalPolicy=()=>Object.fromEntries(['auth','active','today','ownership'].map(key=>[key,{delay:100}]));window.actionReady=()=>qaRequests.some(r=>r.key==='active')&&button('Mark taken')&&!document.querySelector('.today-loading');`)
  if (artworkOnly) {
    await run('(' + installPresentationChecks.toString() + ')()')
    await run(`
      window.qaBaseProtocols=qaProtocols;window.qaArtworkCase='known';
      window.qaProtocols=()=>qaBaseProtocols().map((protocol,index)=>({...protocol,compounds:protocol.compounds.map(compound=>{
        if(index===0){const values={known:{reconstitution_date:'2026-10-01',bac_water_ml:2,doses_taken_override:3},unknown:{reconstitution_date:null,bac_water_ml:null,doses_taken_override:null,vial_strength:null,vial_unit:null},empty:{reconstitution_date:'2026-10-01',bac_water_ml:2,doses_taken_override:10},mcg:{name:'Recorded microgram compound',reconstitution_date:'2026-10-01',bac_water_ml:2,doses_taken_override:3,vial_strength:250,vial_unit:'mcg'},iu:{name:'Recorded IU compound',reconstitution_date:'2026-10-01',bac_water_ml:2,doses_taken_override:3,vial_strength:20,vial_unit:'IU'}}[qaArtworkCase];return {...compound,...values,phases:compound.phases.map(phase=>({...phase,injection_volume_ml:.2,syringe_units:20,syringe_scale:100}))}}
        if(index===1)return {...compound,phases:compound.phases.map(phase=>({...phase,frequency:'1x/week',day_of_week:0}))};
        return compound;
      })}));
      window.qaArtworkReady=()=>document.querySelector('[data-premium-vial]')&&document.querySelector('[data-premium-schedule]')&&button('+ New Vial')&&!button('+ New Vial').disabled;
      window.qaArtworkIds=()=>[...document.querySelectorAll('[data-premium-vial] [id],[data-premium-schedule] [id]')].map(e=>e.id);
      window.qaArtworkLogs=[{compound_id:'c0',date:'2026-09-28',taken:true},{compound_id:'c1',date:'2026-09-29',taken:true}];
      window.qaArtworkReset=async(mode='known')=>{qaArtworkCase=mode;localStorage.setItem('schedule_week_offset','0');qaReset(5,'full',{}, {logs:qaArtworkLogs});await tick();await waitFor(qaArtworkReady)};
      await qaArtworkReset();
      const vial=document.querySelector('[data-premium-vial]'),schedule=document.querySelector('[data-premium-schedule]');
      check(vial.getAttribute('aria-hidden')==='true'&&schedule.getAttribute('aria-hidden')==='true','Artwork SVGs are decorative');
      check(vial.getAttribute('focusable')==='false'&&schedule.getAttribute('focusable')==='false','Artwork adds no SVG keyboard stops');
      check(!vial.parentElement.closest('[aria-hidden="true"]'),'Vial estimate caption is accessible');
      check(getComputedStyle(vial).pointerEvents==='none'&&getComputedStyle(schedule).pointerEvents==='none','Artwork cannot intercept gestures or clicks');
      const ids=qaArtworkIds();check(ids.length>10&&new Set(ids).size===ids.length,'Vial and Schedule gradient IDs are unique');
      for(const svg of [vial,schedule])for(const element of svg.querySelectorAll('[fill],[stroke],[clip-path]'))for(const attribute of ['fill','stroke','clip-path']){const ref=(element.getAttribute(attribute)||'').match(/^url\\(#(.+)\\)$/);if(ref)check([...svg.querySelectorAll('[id]')].some(e=>e.id===ref[1]),'Every paint reference resolves inside its SVG')}
      check(!schedule.querySelector('text,[aria-selected],[aria-pressed],[class*="dayCheck"],[class*="dayHighlight"],[class*="scheduledDot"]'),'Decorative schedule contains no dates, checks or selected-dose markers');
      window.qaInitialVial=vial;window.qaInitialSchedule=schedule;window.qaInitialIds=ids.join(',');
      const animations=[...vial.getAnimations({subtree:true}),...schedule.getAnimations({subtree:true})];
      check(animations.length>=4,'Enhanced artwork has finite material motion');
      for(const animation of animations){const timing=animation.effect.getTiming();check(timing.iterations===1&&timing.duration<=1800&&timing.delay+timing.duration+timing.endDelay<=1800,'Each artwork sequence finishes within 1.8 seconds')}
      window.qaArtworkAnimations=animations;
      const before=qaRequests.length;document.querySelector('.today-weekly-schedule > div').querySelectorAll('button')[1].click();await tick();
      check(document.querySelector('.today-weekly-schedule').textContent.includes('Next Week'),'Week navigation acts during artwork motion');
      check(qaRequests.length===before&&qaWrites.length===0,'Week navigation and artwork add no network requests or writes');
      check(document.querySelector('[data-premium-vial]')===qaInitialVial&&document.querySelector('[data-premium-schedule]')===qaInitialSchedule&&qaArtworkIds().join(',')===qaInitialIds,'Navigation keeps artwork nodes and SVG IDs stable');
      document.querySelector('.today-weekly-schedule > div').querySelector('button').click();await tick();
      await Promise.all(qaArtworkAnimations.map(animation=>animation.finished));
      check(qaArtworkAnimations.every(animation=>animation.playState==='finished'),'Artwork stops after its one-shot sequence');
      check(qaRequests.length===before&&qaWrites.length===0,'Finishing artwork starts no requests or writes');
      const row=id=>document.querySelector('[data-compound-id="'+id+'"]'),cell=(id,day)=>row(id).querySelectorAll('td')[day+1],symbol=(id,day)=>cell(id,day).textContent.trim();
      check(document.querySelector('.today-weekly-schedule thead').querySelectorAll('th').length===8,'Real schedule retains seven dates and compound column');
      check(symbol('c0',0)===String.fromCodePoint(10003),'Recorded Monday dose remains logged');
      check(symbol('c1',1)===String.fromCodePoint(10003),'Recorded off-plan Tuesday dose remains logged');
      check(getComputedStyle(cell('c1',1).querySelector('button')).backgroundColor==='rgba(245, 158, 11, 0.9)','Off-plan log retains its warm semantic color');
      check(symbol('c2',0)===String.fromCodePoint(183),'Past unlogged due dose retains missed marker');
      check(symbol('c2',6)===String.fromCodePoint(9679),'Today unlogged due dose retains due marker');
      check(document.querySelector('.today-snapshot-vial').textContent.includes('70%')&&document.querySelector('.today-snapshot-vial').textContent.includes('1.4 mL'),'Real Hero supplies the existing 70 percent / 1.4 mL estimate');
      check(document.querySelector('[data-vial-liquid]'),'Known positive estimate has liquid geometry');
      document.querySelectorAll('.protocol-ring-named')[4].click();await tick();await waitFor(()=>document.getElementById('selected-protocol-name').textContent.includes('very long'));
      check(document.querySelector('.today-snapshot-vial').textContent.includes('Remaining unknown')&&!document.querySelector('[data-vial-liquid]'),'Selecting another protocol does not inherit known liquid');
      check(document.querySelector('[data-premium-vial]')===qaInitialVial&&document.querySelector('[data-premium-schedule]')===qaInitialSchedule&&qaArtworkIds().join(',')===qaInitialIds,'Protocol selection reuses artwork nodes and stable IDs');
    `)
    const artworkMatrix=[]
    for (const theme of ['dark','light']) for (const width of [320,390,1440]) {
      await viewport(width)
      await run(`document.documentElement.dataset.theme='${theme}';await qaArtworkReset();qaPresentationCache();
        for(const svg of document.querySelectorAll('[data-premium-vial],[data-premium-schedule]'))for(const animation of svg.getAnimations({subtree:true}))animation.finish();
        check(document.documentElement.scrollWidth<=innerWidth,'Enhanced components fit ${theme} ${width}');
        const snapshot=document.querySelector('.today-protocol-snapshot'),schedule=document.querySelector('.today-weekly-schedule'),graphic=schedule.querySelector('[data-premium-schedule]');
        qaTextBounds(snapshot,'Enhanced snapshot ${theme} ${width}');
        for(const element of snapshot.querySelectorAll('figcaption span,figcaption strong'))qaTextContrast(element,'Enhanced caption ${theme} ${width}');
        check(snapshot.scrollWidth<=snapshot.clientWidth,'Snapshot has no horizontal clipping ${theme} ${width}');
        check(schedule.querySelector('.today-weekly-schedule-scroll').scrollWidth<=schedule.querySelector('.today-weekly-schedule-scroll').clientWidth,'Seven-day grid fits ${theme} ${width}');
        check(graphic.getBoundingClientRect().width<=70&&graphic.getBoundingClientRect().height<=50,'Schedule art remains secondary ${theme} ${width}');
        for(const button of schedule.querySelector('div').querySelectorAll('button')){const a=graphic.getBoundingClientRect(),b=button.getBoundingClientRect();check(a.right<=b.left||a.left>=b.right||a.bottom<=b.top||a.top>=b.bottom,'Schedule artwork does not overlap navigation ${theme} ${width}')}
        snapshot.scrollIntoView({block:'start'});await tick();`)
      await screen('today-artwork-vial-known-'+theme+'-'+width)
      await run("document.querySelector('.today-weekly-schedule').scrollIntoView({block:'start'});await tick();")
      await screen('today-artwork-schedule-'+theme+'-'+width)
      await run(`await qaArtworkReset('unknown');for(const svg of document.querySelectorAll('[data-premium-vial],[data-premium-schedule]'))for(const animation of svg.getAnimations({subtree:true}))animation.finish();const snapshot=document.querySelector('.today-protocol-snapshot');qaPresentationCache();qaTextBounds(snapshot,'Unknown inventory ${theme} ${width}');check(snapshot.textContent.includes('Remaining unknown')&&!snapshot.querySelector('[data-vial-liquid]'),'Unknown liquid is never rendered full ${theme} ${width}');snapshot.scrollIntoView({block:'start'});await tick();`)
      await screen('today-artwork-vial-unknown-'+theme+'-'+width)
      artworkMatrix.push({theme,width})
    }
    await viewport(390)
    for(const scenario of [{mode:'empty',copy:'0%',unit:'10 mg'},{mode:'mcg',copy:'70%',unit:'250 mcg'},{mode:'iu',copy:'70%',unit:'20 IU'}]) {
      await run(`await qaArtworkReset('${scenario.mode}');const visual=document.querySelector('.today-snapshot-vial');check(visual.textContent.includes('${scenario.copy}')&&visual.textContent.includes('${scenario.unit}'),'${scenario.mode} preserves recorded units and estimated remaining');check(Boolean(visual.querySelector('[data-vial-liquid]'))===${scenario.mode!=='empty'},'${scenario.mode} liquid geometry matches known positive amount');check(qaWrites.length===0,'${scenario.mode} read makes no writes');`)
    }
    await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]})
    await run(`await qaArtworkReset();const art=[...document.querySelectorAll('[data-premium-vial],[data-premium-schedule]')];check(art.every(svg=>svg.getAnimations({subtree:true}).length===0),'Reduced motion suppresses all artwork sequences');check(art.every(svg=>[...svg.querySelectorAll('*')].every(e=>getComputedStyle(e).animationName==='none')),'Reduced motion artwork has no CSS animation');check(document.querySelector('.today-snapshot-vial').textContent.includes('70%')&&button('Mark taken')&&!button('Mark taken').disabled,'Reduced motion retains truthful data and immediate actions');document.querySelector('.today-protocol-snapshot').scrollIntoView({block:'start'});await tick();`)
    await screen('today-artwork-reduced-motion-390')
    await cdp('Emulation.setEmulatedMedia',{features:[]})
    await run("qaReset(0,'empty');await tick();check(!document.querySelector('[data-premium-vial],[data-premium-schedule]'),'Empty protocols do not fabricate Vial or Schedule artwork');check(errors.length===0,'No runtime errors in artwork matrix');")
    const report={passed:(await run('return checks')).length,checks:await run('return checks'),sourceHashes,screenshots,artworkMatrix,errors:await run('return errors'),fixture:'Actual Today with fictional Supabase in local Chrome; finite artwork, semantic state and SVG identity checks; CSS Modules transformed locally; no Safari or live backend verification.'}
    const reportPath=path.join(dir,'today-artwork.json')
    fs.writeFileSync(reportPath,JSON.stringify(report,null,2))
    console.log(JSON.stringify({passed:report.passed,screenshots,report:reportPath},null,2))
    return
  }

  if (presentationOnly) {
  // Presentation acceptance is checked for every supported width and both themes.
  await run('(' + installPresentationChecks.toString() + ')()')
  for (const theme of ['dark', 'light']) for (const width of [320, 360, 390, 600, 768, 1024, 1440]) {
    const label = theme + ' ' + width, prefix = 'today-presentation-' + theme + '-' + width
    await viewport(width)
    await run(`document.documentElement.dataset.theme='${theme}';qaReset(5,'focus');await tick();await waitFor(()=>document.querySelector('.today-weekly-schedule'));window.scrollTo(0,0);qaPresentationCache();
      check(document.documentElement.scrollWidth<=innerWidth,'Presentation page fits ${label}');
      const selectors=['#health-title','#focus-title','header time','header button span','.today-health-metrics span','.today-health-metrics strong','.today-health-metrics small','[class*="_healthChange"]','[class*="_healthLatest"]','[class$="_doseEyebrow"]','[class$="_dueTime"]','[class$="_doseAmount"]','[class$="_focusReview"]','[class$="_heroManage"]','[class$="_heroExport"]','.protocol-ring-name','.protocol-ring-week','.today-snapshot-heading h3','.today-snapshot-heading>span','.today-snapshot-plan','.today-snapshot-fact dt','.today-snapshot-fact dd','.today-snapshot-medication strong','.today-snapshot-medication span','.today-snapshot-actions a','.vial-lifecycle-title','.vial-lifecycle-status','.vial-new-button'];
      const text=[...document.querySelectorAll(selectors.join(','))].filter(e=>e.getClientRects().length&&e.textContent.trim());
      check(text.length>=40,'Rendered text contrast sample is populated ${label}');
      for(const element of [...text,button('Mark taken'),button('Review check-in')]){qaTextContrast(element,'${label}');qaTextBounds(element,'${label}')}
      const longRing=[...document.querySelectorAll('.protocol-ring-name')].find(e=>e.textContent.includes('very long'));
      check(longRing&&longRing.textContent.includes('fully readable'),'Long compound fixture retained ${label}');
      const fullName=longRing.textContent;longRing.closest('button').click();await tick();qaPresentationCache();
      const selectedName=document.getElementById('selected-protocol-name');check(selectedName.textContent===fullName,'Selecting clamped ring exposes full compound name ${label}');qaTextBounds(selectedName,'${label} full selected compound');qaTextContrast(selectedName,'${label} full selected compound');
      document.querySelector('.protocol-ring-named').click();await tick();qaPresentationCache();
      check(qaWrites.length===0,'Presentation read makes no writes ${label}');`)
    await screen(prefix + '-top')
    for (const target of ["button('Mark taken')", "document.querySelector('.protocol-ring-named')", "button('Review check-in')"]) {
      await run('qaPrepareTab(' + target + ')')
      await press('Tab', 'Tab', 9)
      await run(`qaVisibleFocus('${label} '+qaFocusTarget.textContent.trim().slice(0,30));`)
    }
    await run(`document.querySelector('.today-protocol-snapshot').scrollIntoView({block:'start'});await tick();qaTextBounds(document.querySelector('.today-protocol-snapshot'),'${label} snapshot');
      window.scrollTo(0,document.body.scrollHeight);await tick();
      const nav=document.querySelector('.app-tab-bar').getBoundingClientRect(),trigger=button('Review check-in').getBoundingClientRect(),main=document.querySelector('main').getBoundingClientRect();
      check(nav.bottom<=innerHeight+1&&nav.top>=0,'Navigation remains in viewport ${label}');
      check(main.bottom<=nav.top+1,'Final content clears navigation ${label}');
      check(trigger.bottom<nav.top&&trigger.left>=0&&trigger.right<=innerWidth,'Floating review clears navigation ${label}');
      check([...document.querySelectorAll('.app-tab-bar a')].every(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2))}),'Navigation controls unobstructed ${label}');`)
    await screen(prefix + '-bottom')
    await run(`button('Review check-in').click();await tick();const panel=document.getElementById('daily-checkin-panel');for(const animation of panel.getAnimations())animation.finish();qaPresentationCache();
      const bounds=panel.getBoundingClientRect(),nav=document.querySelector('.app-tab-bar').getBoundingClientRect();
      check(bounds.left>=0&&bounds.right<=innerWidth&&bounds.top>=0&&bounds.bottom<nav.top,'Check-in clears viewport and navigation ${label}');
      check(panel.scrollWidth<=panel.clientWidth,'Check-in has no horizontal clipping ${label}');
      for(const element of panel.querySelectorAll('h2,label,.today-checkin-score-label,.today-checkin-delta,button,input,textarea'))if(element.getClientRects().length){qaTextContrast(element,'${label} check-in');if(!element.matches('input,textarea'))qaTextBounds(element,'${label} check-in')}
      check(!button('Update').matches(':disabled'),'Check-in action remains enabled ${label}');`)
    await screen(prefix + '-checkin')
    await run(`button('Done').click();await tick();window.scrollTo(0,0);qaPolicy['write:injection_logs']={delay:250};
      window.qaPendingAction=button('Mark taken');window.qaEnabledOpacity=getComputedStyle(qaPendingAction).opacity;qaPendingAction.click();await waitFor(()=>qaPendingAction.matches(':disabled'));
      const pendingStyle=getComputedStyle(qaPendingAction);check(qaPendingAction.matches(':disabled')&&pendingStyle.cursor==='default'&&Number(pendingStyle.opacity)<Number(qaEnabledOpacity),'Pending dose preserves distinct disabled styling ${label}: '+JSON.stringify({disabled:qaPendingAction.matches(':disabled'),cursor:pendingStyle.cursor,opacity:pendingStyle.opacity,enabledOpacity:qaEnabledOpacity}));
      qaPendingAction.click();await waitFor(()=>button('Mark taken')&&!button('Mark taken').matches(':disabled'));
      check(qaWrites.filter(w=>w.table==='injection_logs').length===1,'Disabled dose cannot duplicate a write ${label}');
      check(document.querySelector('progress').value===1,'Pending dose recovers to saved state ${label}');`)
    presentationMatrix.push({ theme, width, states: ['default', 'keyboard-focus', 'check-in', 'disabled-save'], screenshots: screenshots.filter(file => path.basename(file).startsWith(prefix + '-')) })
  }
  await viewport(390)
  await run(`document.documentElement.dataset.theme='dark';qaReset(5);await tick();window.scrollTo(0,0);`)
  await run("check(errors.length===0,'No runtime errors in presentation matrix');")
  const report = { passed: (await run('return checks')).length, checks: await run('return checks'), sourceHashes, screenshots, presentationMatrix, errors: await run('return errors'), fixture: 'Presentation matrix of actual Today Page and AppShell with fictional mocked Supabase; CSS Modules transformed locally; no production or live backend verification.' }
  const reportPath = path.join(dir, 'today-presentation.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: report.passed, screenshots, report: reportPath }, null, 2))
  return
  }
  if (!baselineDir) {
    console.log('Checking disabled and enabled schedule reordering')
    await run(`
      window.scheduleRows=()=>[...document.querySelectorAll('.today-weekly-schedule [data-compound-id]')];
      window.scheduleOrder=()=>scheduleRows().map(row=>row.dataset.compoundId).join(',');
      window.positionWrites=()=>qaWrites.filter(write=>write.table==='compounds'&&Object.hasOwn(write.value,'position'));
      window.scheduleDisabled=()=>document.querySelector('.today-weekly-schedule')?.closest('fieldset').disabled;
      window.gestureEvent=async(row,type)=>{
        row.scrollIntoView({block:'center'});
        const box=row.getBoundingClientRect(),event=new Event(type,{bubbles:true,cancelable:true});
        Object.defineProperty(event,'touches',{value:[{clientX:Math.max(1,box.left+20),clientY:box.top+box.height/2}]});
        row.dispatchEvent(event);await new Promise(resolve=>setTimeout(resolve,20));
      };
      window.reorder=async(kind)=>{
        const [first,second]=scheduleRows();
        await gestureEvent(first,kind==='drag'?'dragstart':'touchstart');
        await gestureEvent(second,kind==='drag'?'dragover':'touchmove');
        await gestureEvent(second,kind==='drag'?'drop':'touchend');
      };
      window.expectBlockedReorder=async(label)=>{
        check(scheduleDisabled(),label+' disables schedule');
        const before=scheduleOrder(),writes=positionWrites().length;
        for(const kind of ['drag','touch']){
          await reorder(kind);
          check(positionWrites().length===writes,label+' blocks '+kind+' position writes');
          check(scheduleOrder()===before,label+' preserves '+kind+' row order');
        }
        check(scheduleRows().every(row=>!row.draggable),label+' removes native draggable behavior');
      };
      qaReset(3);await tick();await waitFor(()=>scheduleRows().length===3&&!scheduleDisabled());
      qaPolicy.history={fail:true};window.dispatchEvent(new Event('doses_updated'));
      await waitFor(()=>button('Retry history'));await expectBlockedReorder('Failed history refresh');
      qaPolicy.history={delay:500};button('Retry history').click();await tick();
      await expectBlockedReorder('Pending history retry');
      await waitFor(()=>!scheduleDisabled());check(scheduleRows().every(row=>row.draggable),'History retry restores reordering');
      qaPolicy.history={};qaPolicy.active={delay:500};window.dispatchEvent(new Event('doses_updated'));await tick();
      await expectBlockedReorder('Active refresh');await waitFor(()=>!scheduleDisabled());
      qaPolicy.active={};qaPolicy.today={fail:true};window.dispatchEvent(new Event('doses_updated'));
      await waitFor(()=>button('Try again'));await expectBlockedReorder('Critical loading failure');
      qaPolicy.today={};button('Try again').click();await waitFor(()=>!scheduleDisabled());
    `)
    for (const kind of ['drag', 'touch']) {
      await run(`
        qaReset(3);await tick();await waitFor(()=>scheduleRows().length===3&&!scheduleDisabled());
        await reorder('${kind}');await waitFor(()=>positionWrites().length===3);
        check(scheduleOrder()==='c1,c0,c2','Enabled ${kind} reorders rows');
        check(JSON.stringify(positionWrites().map(w=>[w.filters.id,w.value.position]))===JSON.stringify([['c1',0],['c0',1],['c2',2]]),'Enabled ${kind} preserves compound IDs and zero-based positions');
        qaWrites=[];
        const first=scheduleRows()[0],second=scheduleRows()[1],before=scheduleOrder();
        await gestureEvent(first,'${kind === 'drag' ? 'dragstart' : 'touchstart'}');
        await gestureEvent(second,'${kind === 'drag' ? 'dragover' : 'touchmove'}');
        qaPolicy.history={fail:true};window.dispatchEvent(new Event('doses_updated'));await waitFor(()=>button('Retry history'));
        check(scheduleRows().every(row=>row.style.opacity==='1'),'Disabling clears active ${kind} gesture');
        await gestureEvent(second,'${kind === 'drag' ? 'drop' : 'touchend'}');
        check(positionWrites().length===0&&scheduleOrder()===before,'Disabling mid-${kind} prevents completion');
        qaPolicy.history={};button('Retry history').click();await waitFor(()=>!scheduleDisabled());
        await gestureEvent(second,'${kind === 'drag' ? 'drop' : 'touchend'}');
        check(positionWrites().length===0&&scheduleOrder()===before,'Re-enabling cannot revive old ${kind} gesture');
        await reorder('${kind}');await waitFor(()=>positionWrites().length===3);
        check(scheduleOrder()==='c0,c1,c2','A fresh ${kind} works after retry');
      `)
    }
    for (const transition of ['disabled', 'reenabled', 'unmounted']) {
      await run(`
        qaReset(3,'full',{'write:compounds':{delay:600}});await tick();await waitFor(()=>scheduleRows().length===3&&!scheduleDisabled());
        await reorder('drag');await waitFor(()=>positionWrites().length===1);
        ${transition === 'unmounted' ? "qaEmitAuth('SIGNED_OUT',null);await tick();check(scheduleRows().length===0,'Sign-out unmounts schedule');" : "qaPolicy.history={fail:true};window.dispatchEvent(new Event('doses_updated'));await waitFor(()=>button('Retry history'));"}
        ${transition === 'reenabled' ? "qaPolicy.history={};button('Retry history').click();await waitFor(()=>!scheduleDisabled());" : ''}
        await new Promise(resolve=>setTimeout(resolve,700));
        check(positionWrites().length===1,'Pending reorder stops subsequent writes when ${transition}');
      `)
    }
    await run(`qaReset(3,'full',{history:{fail:true}});await tick();await waitFor(()=>button('Retry history'));check(scheduleRows().length===0&&positionWrites().length===0,'Initial history failure exposes no reorder surface or position writes');check(errors.length===0,'No runtime errors after schedule safety checks');`)
    if (scheduleOnly) {
      const report = { passed: (await run('return checks')).length, checks: await run('return checks'), sourceHashes, errors: await run('return errors'), fixture: 'Actual Today and WeeklySchedule in local headless Chrome; fictional Supabase only; synthetic drag and touch events.' }
      const reportPath = path.join(dir, 'today-schedule-safety.json')
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
      console.log(JSON.stringify({ passed: report.passed, report: reportPath }, null, 2))
      return
    }
  }
  await run(`qaReset(5,'full',criticalPolicy());await tick();await waitFor(actionReady);metrics.healthyActionMs=Math.round(performance.now()-qaMountedAt);check(metrics.healthyActionMs<1000,'Healthy critical data produces actions within one second');`)
  const delayed = await run(`qaReset(5,'full',{...criticalPolicy(),history:{delay:30000}});await tick();await waitFor(actionReady,35000);metrics.history30sActionMs=Math.round(performance.now()-qaMountedAt);return metrics.history30sActionMs;`)
  console.log(JSON.stringify({ source: baselineDir ? 'before-backup' : 'after-working-tree', history30sActionMs: delayed }))
  if (baselineDir) {
    const reportPath = path.join(dir, 'today-performance-before.json')
    fs.writeFileSync(reportPath, JSON.stringify({ source: 'Verified pre-change backups bundled in memory', metrics: await run('return metrics'), errors: await run('return errors'), scope: 'Fictional mocked requests in local headless Chrome; not production latency' }, null, 2))
    console.log(JSON.stringify({ report: reportPath }, null, 2))
    return
  }
  await run(`check(metrics.history30sActionMs<1000,'A 30-second historical read does not block critical actions');check(!document.querySelector('.today-weekly-schedule'),'Pending history does not display an empty schedule');check(!qaRequests.some(r=>r.key==='protocol_events'),'Unused events query is absent');await waitFor(()=>button('Retry history'),12000);metrics.historyDeadlineMs=Math.round(performance.now()-qaMountedAt);check(metrics.historyDeadlineMs>=9500&&metrics.historyDeadlineMs<11500,'Secondary history deadline is approximately ten seconds');check(qaRequests.some(r=>r.key==='history'&&r.aborted),'History deadline aborts the database request');check(button('Mark taken'),'History timeout keeps critical actions');qaPolicy.history={};button('Retry history').click();await waitFor(()=>document.querySelector('.today-weekly-schedule'));check(button('Mark taken'),'History section retry recovers independently');`)
  await run(`qaReset(5);await tick();`)
  if (!performanceOnly) {
  for (const theme of ['dark','light']) for (const width of [390,1440]) {
    await viewport(width)
    await run(`document.documentElement.dataset.theme='${theme}';qaReset(5,'focus');qaLogs=[1,2,3,4].map(i=>({compound_id:'c'+i,date:'2026-10-04',taken:true}));await tick();window.scrollTo(0,0);await tick();
      const focus=document.querySelector('[aria-labelledby="focus-title"]'),panel=focus.querySelector('[class$="_nextDose"]'),copy=focus.querySelector('[class$="_doseCopy"]'),eyebrow=focus.querySelector('[class$="_doseEyebrow"]'),time=focus.querySelector('[class$="_dueTime"]'),review=focus.querySelector('[class$="_focusReview"]'),mark=button('Mark taken');
      check(eyebrow.textContent==='Next dose'&&time.textContent==='Today · night','Focus retains timing ${theme} ${width}');
      check(focus.querySelector('h3').textContent==='HGH'&&focus.querySelector('[class$="_doseAmount"]').textContent==='1 IU','Focus retains medication ${theme} ${width}');
      check(parseFloat(getComputedStyle(eyebrow).fontSize)>=14&&parseFloat(getComputedStyle(time).fontSize)>=13,'Focus labels enlarged ${theme} ${width}');
      check(parseFloat(getComputedStyle(focus.querySelector('h3')).fontSize)>=14,'Focus medication enlarged ${theme} ${width}');
      check(review.textContent==='Vial details need review','Full warning preserved ${theme} ${width}');
      const range=document.createRange();range.selectNodeContents(review);const lines=[...range.getClientRects()];
      check(lines.length===1,'Warning stays on one line ${theme} ${width}');
      check(review.scrollWidth<=review.clientWidth&&lines[0].left>=panel.getBoundingClientRect().left&&lines[0].right<=panel.getBoundingClientRect().right,'Warning fully visible ${theme} ${width}');
      check(copy.contains(review)&&copy.getAttribute('aria-live')==='polite','Warning remains in dose announcement ${theme} ${width}');
      const panelBox=panel.getBoundingClientRect(),focusBox=focus.getBoundingClientRect(),markBox=mark.getBoundingClientRect();
      if(${width}===390){
        const center=(panelBox.left+panelBox.right)/2,eyebrowText=document.createRange(),timeText=document.createRange();
        eyebrowText.selectNodeContents(eyebrow.lastChild);timeText.selectNodeContents(time);
        const eyebrowBox=eyebrowText.getBoundingClientRect(),timeBox=timeText.getBoundingClientRect(),nameBox=focus.querySelector('h3').getBoundingClientRect(),amountBox=focus.querySelector('[class$="_doseAmount"]').getBoundingClientRect();
        check(Math.abs((eyebrowBox.left+eyebrowBox.right)/2-center)<1,'Mobile Next dose text centered ${theme}');
        check(Math.abs((nameBox.left+amountBox.right)/2-center)<1,'Mobile medication centered ${theme}');
        check(Math.abs((timeBox.left+timeBox.right)/2-center)<1,'Mobile timing centered ${theme}');
        check(getComputedStyle(review).textAlign==='left'&&Math.abs(lines[0].left-panelBox.left-7)<1&&getComputedStyle(review).fontSize==='12px'&&getComputedStyle(review).lineHeight==='16px','Mobile warning alignment and size unchanged ${theme}');
      }
      if(${width}===1440){
        const doseRight=focus.querySelector('[class$="_doseAmount"]').getBoundingClientRect().right,buttonCenter=(markBox.left+markBox.right)/2;
        check(Math.abs(buttonCenter-(doseRight+panelBox.right)/2)<5,'Desktop action centered between medication and panel edge ${theme}: '+JSON.stringify({doseRight,buttonCenter,panelRight:panelBox.right}));
      }
      check(panelBox.width<=360&&Math.abs((panelBox.left+panelBox.right-focusBox.left-focusBox.right)/2)<1,'Dose panel centered and bounded ${theme} ${width}');
      if(${width}===1440)check(panelBox.width<focusBox.width*.9,'Desktop green panel is narrower ${theme}');
      if(${width}===390)check(markBox.width<=110&&markBox.width<panelBox.width*.8,'Mobile action fits its label ${theme}');
      check(markBox.height>=44&&markBox.height<=48,'Action keeps compact touch target ${theme} ${width}');
      check(focus.scrollWidth<=focus.clientWidth&&document.documentElement.scrollWidth<=innerWidth,'Focus does not overflow ${theme} ${width}');
      check(qaWrites.length===0,'Focus rendering makes no writes ${theme} ${width}');`)
    await screen('today-focus-' + theme + '-' + width)
    await run(`button('Mark taken').click();await tick();check(qaWrites.filter(w=>w.table==='injection_logs'&&w.value.compound_id==='c0'&&w.value.taken).length===1,'Compact action logs selected dose exactly once ${theme} ${width}');check(!button('Mark taken'),'Compact action advances to completion ${theme} ${width}');`)
  }
  await viewport(390)
  await run(`document.documentElement.dataset.theme='dark';qaReset(5);await tick();window.scrollTo(0,0);`)
  for (const theme of ['dark','light']) for (const width of [320,360,390,600,768,1024,1440]) {
    await viewport(width)
    await run(`document.documentElement.dataset.theme='${theme}';await tick();
      const health=document.getElementById('health-title'),focus=document.getElementById('focus-title'),healthText=document.createRange(),focusText=document.createRange();
      healthText.selectNodeContents(health.lastChild);focusText.selectNodeContents(focus.lastChild);
      const healthBounds=healthText.getBoundingClientRect(),focusBounds=focusText.getBoundingClientRect(),healthIcon=health.querySelector('svg').getBoundingClientRect(),focusIcon=focus.querySelector('svg').getBoundingClientRect();
      check(Math.abs(healthBounds.top-focusBounds.top)<1&&Math.abs(healthBounds.bottom-focusBounds.bottom)<1,'Summary title text aligned ${theme} ${width}: '+JSON.stringify({healthTop:healthBounds.top,focusTop:focusBounds.top}));
      check(Math.abs((healthIcon.top+healthIcon.bottom-focusIcon.top-focusIcon.bottom)/2)<1,'Summary title icons aligned ${theme} ${width}');`)
  }

  await run(`document.documentElement.dataset.theme='dark';`)
  for (const width of [320, 390, 768, 1024, 1440]) {
    await viewport(width)
    await run(`await tick();check(document.documentElement.scrollWidth<=innerWidth,'Page fits ${width}');check(document.querySelectorAll('.protocol-ring-named').length===5,'Every ring ${width}');check(!document.querySelector('[aria-label="Active protocol details"]'),'Redundant list absent ${width}');check([...document.querySelectorAll('details')].every(e=>!e.open),'Disclosures closed ${width}');const mark=button('Mark taken').getBoundingClientRect(),hero=document.querySelector('[aria-labelledby="active-title"]').getBoundingClientRect(),focus=document.querySelector('[aria-labelledby="focus-title"]').getBoundingClientRect();check(mark.width>=44&&mark.height>=44,'Primary target ${width}');check(focus.bottom<=hero.top,'Focus above hero ${width}');const health=document.querySelector('[aria-labelledby="health-title"]').getBoundingClientRect();check(health.right<=focus.left&&Math.abs(health.top-focus.top)<2,'Health left and Focus right ${width}');check(Math.abs(health.left-hero.left)<2&&Math.abs(focus.right-hero.right)<2,'Summary aligns with hero ${width}');check(Math.abs(health.width-focus.width)<2&&Math.abs(health.height-focus.height)<2,'Paired cards match dimensions ${width}');check(document.querySelectorAll('[aria-labelledby="focus-title"]').length===1,'One paired Focus ${width}');const healthCard=document.querySelector('[aria-labelledby="health-title"]'),bars=healthCard.querySelector('[class$="_healthBars"] svg');check(bars&&bars.getAttribute('aria-hidden')==='true'&&bars.querySelector('path').getAttribute('d')==='M4 20v-7m5 7V8m6 12V4m5 16v-9'&&!healthCard.querySelector('polyline'),'Production vertical bars ${width}');const healthStyle=getComputedStyle(healthCard),rightEdge=health.right-parseFloat(healthStyle.paddingRight)-parseFloat(healthStyle.borderRightWidth),weightReading=healthCard.querySelector('[class$="_healthWeight"]').getBoundingClientRect();check(Math.abs((weightReading.left+weightReading.right-health.left-health.right)/2)<2,'Weight centered ${width}');check([...healthCard.querySelectorAll('[class*="_healthChange"],[class*="_healthLatest"]')].every(e=>getComputedStyle(e).borderTopStyle==='solid'),'Subtle metadata pills ${width}');if(${width}>=760){const entries=healthCard.querySelector('.today-journal-link').getBoundingClientRect();check(entries.top<weightReading.top,'Manage entries in header ${width}');}check(Math.abs(bars.getBoundingClientRect().right-rightEdge)<2,'Bars at right edge ${width}');check(healthCard.scrollWidth<=healthCard.clientWidth,'Health text fits ${width}');if(${width}>=760)check(health.height<=220&&focus.height<=220,'Compact desktop cards ${width}: '+focus.height+'px');const manage=document.querySelector('[class$="_heroManage"]'),manageBounds=manage.getBoundingClientRect();check(Math.abs((manageBounds.left+manageBounds.right-hero.left-hero.right)/2)<2,'Manage centered above rings ${width}');check(getComputedStyle(button('↓ Export CSV')).color===getComputedStyle(manage).color,'CSV matches Manage purple ${width}');check(![...document.querySelectorAll('a')].some(e=>e.textContent==='→ My Protocols'),'Bottom My Protocols removed ${width}');const warning=[...document.querySelectorAll('strong')].find(e=>e.textContent==='You may have missed a dose today')?.parentElement.parentElement;if(warning){const bounds=warning.getBoundingClientRect();check(bounds.top>=Math.max(health.bottom,focus.bottom)&&bounds.bottom<=hero.top,'Warning between summary and hero ${width}');}check(document.querySelectorAll('[aria-labelledby="health-title"]').length===1,'One Health card ${width}');const weight=document.querySelector('header button[aria-label^="Current weight"]');check(weight!==null,'Current Weight in header ${width}');check(weight.getBoundingClientRect().width<=180,'Compact header tile ${width}');check(document.querySelector('header').getBoundingClientRect().bottom<=focus.top,'Focus below greeting and weight ${width}');check(document.querySelector('main>div').getBoundingClientRect().width<=960,'Focused page width ${width}');const rings=[...document.querySelectorAll('.protocol-ring-named')],last=rings.slice(-2).map(e=>e.getBoundingClientRect()),box=document.querySelector('.protocol-ring-composition').getBoundingClientRect();check(Math.abs((last[0].left+last[1].right)/2-(box.left+box.right)/2)<2,'Final ring row centered ${width}');check(Math.abs((box.left+box.right)/2-(hero.left+hero.right)/2)<2,'Hero rings centered ${width}');check(rings.every(e=>e.getBoundingClientRect().width>=80&&e.getBoundingClientRect().width<=180),'Ring size ${width}');const adjacent=rings.slice(1,4).map(e=>e.getBoundingClientRect()),distance=(a,b)=>Math.hypot((a.left+a.right-b.left-b.right)/2,(a.top+a.bottom-b.top-b.bottom)/2);check(distance(adjacent[0],adjacent[1])<(adjacent[0].width+adjacent[1].width)/2&&distance(adjacent[0],adjacent[2])<(adjacent[0].width+adjacent[2].width)/2,'Rings slightly overlap ${width}');const schedule=document.querySelector('.today-weekly-schedule-scroll');check(schedule.scrollWidth<=schedule.clientWidth&&schedule.scrollHeight<=schedule.clientHeight,'Schedule fits without internal scroll ${width}');check(schedule.querySelectorAll('thead th').length===8,'All seven days present ${width}');check(rings.every(e=>parseFloat(getComputedStyle(e).borderTopWidth)>=4&&getComputedStyle(e).boxShadow!=='none'),'Ring stroke and restrained depth ${width}');check(rings.every(e=>parseFloat(getComputedStyle(e.querySelector('.protocol-ring-name')).fontSize)>=(${width}<600?11:14)&&parseInt(getComputedStyle(e.querySelector('.protocol-ring-name')).fontWeight)>=700),'Ring text stronger ${width}');check(document.querySelectorAll('.today-snapshot-fact dt').length===9,'Snapshot facts visible ${width}');check(!document.getElementById('daily-checkin-title'),'Full check-in card removed ${width}');check(button('Review check-in')&&!button('Review check-in').hidden,'Floating review available ${width}');check(!summary('Selected protocol tools')&&!summary('All doses today')&&!document.getElementById('changes-title'),'Removed surfaces absent ${width}');`)
    if (width === 390 || width === 1440) await screen('today-dark-' + width)
  }
  await viewport(390)
  await run(`document.querySelectorAll('.protocol-ring-named')[1].click();await tick();check(document.querySelectorAll('.protocol-ring-named')[1].getAttribute('aria-pressed')==='true','Ring selected state');check(document.getElementById('selected-protocol-name').textContent==='GHK-Cu','Ring selects snapshot');document.querySelectorAll('.protocol-ring-named')[0].click();await tick();check(document.querySelectorAll('.protocol-ring-named')[0].getAttribute('aria-pressed')==='true','Ring selection returns');check(qaNavigated==='','Selection does not navigate');check(document.querySelector('.today-snapshot-actions a').getAttribute('href')==='/protocol/manage?protocol=p0','Snapshot manages selected protocol');check(!document.getElementById('daily-checkin-panel'),'Recorded day does not auto-prompt');button('Review check-in').focus();`)
  await press('Enter', 'Enter', 13)
  await run(`await tick();check(document.getElementById('daily-checkin-panel')!==null,'Keyboard opens panel');check(document.activeElement.id==='checkin-dialog-title','Manual panel heading receives focus');check(document.getElementById('daily-checkin-panel').getAttribute('aria-modal')==='false','Check-in is non-modal');const pageLink=document.querySelector('.app-tab-bar a');pageLink.focus();check(document.activeElement===pageLink,'Page navigation can take focus with panel open');check(document.getElementById('daily-checkin-panel')!==null,'Page interaction keeps check-in open');button('4').click();await tick();check(qaWrites.some(w=>w.table==='journal_entries'&&w.value.mood===4),'Check-in callback writes only mocked transport');const notes=document.querySelector('[aria-label="Check-in notes"]');notes.focus();const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;setter.call(notes,'Keep this draft');notes.dispatchEvent(new Event('input',{bubbles:true}));await tick();`)
  await press('Escape', 'Escape', 27)
  await run(`await tick();check(!document.getElementById('daily-checkin-panel'),'Escape inside dismisses panel');check(document.activeElement===button('Review check-in'),'Focus returns to trigger');button('Review check-in').click();await tick();check(document.querySelector('[aria-label="Check-in notes"]').value==='Keep this draft','Panel retains parent draft');check(document.getElementById('daily-checkin-panel').scrollWidth<=document.getElementById('daily-checkin-panel').clientWidth,'Panel fits mobile');check(button('Review check-in').hidden,'Floating review hides while panel open');`)
  await screen('today-checkin-390')
  await run(`button('Done').click();await tick();check(document.querySelector('[href="/protocol/inventory"]')!==null,'Inventory destination preserved');document.querySelector('.today-protocol-snapshot').scrollIntoView({block:'start'});await tick();check(document.documentElement.scrollWidth<=innerWidth,'Snapshot fits mobile');`)
  await screen('today-snapshot-390')
  await run(`check(button('↓ Export CSV')!==undefined,'CSV action present');check(document.querySelector('[aria-labelledby="active-title"]').contains(button('↓ Export CSV')),'CSV inside hero');check(!document.querySelector('.today-weekly-schedule').contains(button('↓ Export CSV')),'No CSV inside schedule');check(document.querySelector('.today-weekly-schedule')!==null,'Weekly schedule remains mounted');check(document.documentElement.scrollWidth<=innerWidth,'Schedule scroll stays local');check(!summary('Schedule / logs'),'Schedule uses original visible table');qaFailSave=true;button('Mark taken').click();await tick();check(document.querySelector('[role="alert"]').textContent.includes('wasn’t saved'),'Failed save remains visible');check(button('Mark taken')!==undefined,'Failed save keeps pending action');qaFailSave=false;button('Mark taken').click();await tick();check(qaLogs.filter(l=>l.taken).length===1,'Successful dose uses canonical callback');check(document.querySelector('progress').value===1,'Focus completion advances');`)
  // Release corrections: real controlled draft/unit callbacks, no live transport.
  await run(`qaReset(5);await tick();window.scrollTo(0,0);window.weightInput=()=>[...document.querySelectorAll('#daily-checkin-panel label')].find(e=>e.textContent.startsWith('Weight ('))?.querySelector('input');window.toggleUnit=()=>document.querySelector('header button[aria-label^="Current weight"]').click();window.setInput=(input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))};window.settlePanel=async()=>{await tick();await Promise.all(document.getElementById('daily-checkin-panel').getAnimations().map(a=>a.finished))};button('Review check-in').click();await settlePanel();const panel=document.getElementById('daily-checkin-panel'),body=panel.querySelector('[class$="_checkinPanelBody"]');check(body.scrollHeight<=body.clientHeight,'Normal 390x844 check-in needs no internal scrolling');check(weightInput().value==='180','Saved pounds hydrate the actual check-in input');`)
  await screen('today-checkin-normal-390x844')
  await run(`toggleUnit();await tick();check(weightInput().value==='81.6','Open check-in draft converts pounds to kg');check(weightInput().closest('label').textContent==='Weight (kg)','Input label matches converted kg draft');check(document.getElementById('daily-checkin-panel')!==null,'Unit switch leaves non-modal panel open');toggleUnit();await tick();check(weightInput().value==='180','Open check-in unit round trip restores pounds');setInput(weightInput(),'200');await tick();toggleUnit();await tick();check(weightInput().value==='90.7','Unit switch converts an edited draft');toggleUnit();await tick();setInput(weightInput(),'180');await tick();button('Done').click();await tick();toggleUnit();await tick();button('Review check-in').click();await settlePanel();check(weightInput().value==='81.6','Dismissed check-in converts before reopening');check(weightInput().closest('label').textContent==='Weight (kg)','Reopened draft unit stays aligned');button('Update').click();await tick();check(!document.getElementById('daily-checkin-panel'),'Successful converted check-in closes');const saved=qaWrites.filter(w=>w.table==='journal_entries'&&Object.hasOwn(w.value,'weight'));check(saved.length===1,'Exactly one typed weight save');check(Math.abs(saved[0].value.weight-180)<.2,'Converted draft saves about 180 canonical pounds without double conversion');`)
  await viewport(390, 480)
  await run(`qaReset(5);await tick();window.scrollTo(0,0);qaFailSave=true;button('Review check-in').click();await settlePanel();button('Update').click();await tick();for(const score of ['Mood','Energy','Hunger']){document.querySelector('[aria-label="'+score+' 2 of 5"]').click();await tick()}const panel=document.getElementById('daily-checkin-panel'),body=panel.querySelector('[class$="_checkinPanelBody"]'),nav=document.querySelector('.app-tab-bar').getBoundingClientRect();window.visibleInPanel=element=>{const box=element.getBoundingClientRect(),bounds=body.getBoundingClientRect();return box.top>=bounds.top-1&&box.bottom<=bounds.bottom+1&&box.bottom<nav.top};check(panel.querySelectorAll('[role="alert"]').length===4,'390x480 shows typed save and all three score errors');check(panel.getBoundingClientRect().top>=12,'Short panel remains below the viewport top');check(panel.getBoundingClientRect().bottom<nav.top,'Short panel clears bottom navigation');check(body.scrollHeight>body.clientHeight,'Short panel content can scroll internally');check(getComputedStyle(body).overflowY==='auto','Internal scrolling is enabled');check(panel.getAttribute('aria-modal')==='false','Short panel remains non-modal');const heading=panel.querySelector('h2'),close=panel.querySelector('[aria-label="Close daily check-in"]');check(heading.getBoundingClientRect().top>=0,'Short-screen heading remains visible');check(close.getBoundingClientRect().top>=0&&close.getBoundingClientRect().bottom<nav.top,'Short-screen close remains reachable');for(const element of panel.querySelectorAll('input,textarea,[role="alert"]')){element.scrollIntoView({block:'center'});await tick();check(visibleInPanel(element),'Short-screen field/error reachable: '+(element.getAttribute('aria-label')||element.type||element.textContent))}body.scrollTop=body.scrollHeight;await tick();check(visibleInPanel(button('Update')),'Short-screen Update reachable above navigation');check(visibleInPanel(button('Done')),'Short-screen Done reachable above navigation');check(heading.getBoundingClientRect().top>=0&&close.getBoundingClientRect().top>=0,'Scrolling content keeps heading and close visible');`)
  await screen('today-checkin-errors-390x480')
  await run(`document.querySelector('[aria-label="Close daily check-in"]').click();await tick();check(!document.getElementById('daily-checkin-panel'),'Short-screen close dismisses');button('Review check-in').click();await settlePanel();document.getElementById('daily-checkin-panel').querySelector('textarea').focus();`)
  await press('Escape', 'Escape', 27)
  await run(`await tick();check(!document.getElementById('daily-checkin-panel'),'Short-screen Escape dismisses');check(document.activeElement===button('Review check-in'),'Short-screen Escape restores trigger focus');button('Review check-in').click();await settlePanel();const body=document.querySelector('[class$="_checkinPanelBody"]');body.scrollTop=body.scrollHeight;await tick();button('Done').click();await tick();check(!document.getElementById('daily-checkin-panel'),'Short-screen Done dismisses');qaFailSave=false;`)
  await viewport(390)
  await run(`qaReset(0,'empty');await tick();window.scrollTo(0,0);check(document.getElementById('daily-checkin-panel')!==null,'Missing day automatically prompts');check(document.activeElement.id!=='checkin-dialog-title','Automatic panel leaves page focus alone');button('Skip for now').click();await tick();check(!document.getElementById('daily-checkin-panel'),'Skip dismisses missing day');check(document.body.textContent.includes('No doses scheduled today'),'Empty dose state');check(document.body.textContent.includes('Add a weight entry to start seeing your progress over time.'),'Empty health honest');check(!document.getElementById('changes-title'),'No changes card');check(!document.querySelector('.today-weekly-schedule'),'No empty schedule table');check(!button('Mark taken'),'No fabricated primary dose');qaReset(0,'empty');await tick();check(!document.getElementById('daily-checkin-panel'),'Dismissal survives same-day client navigation');`)
  await screen('today-empty-390')
  for (const count of [1, 2, 3, 4, 10, 15]) {
    await run(`qaReset(${count});await tick();const rings=[...document.querySelectorAll('.protocol-ring-named')];check(rings.length===${count},'Ring count ${count}');check(!document.querySelector('[aria-label="Active protocol details"]'),'No duplicated selector ${count}');check(document.documentElement.scrollWidth<=innerWidth,'Many protocols fit ${count}');`)
  }
  await run(`qaReset(5);await tick();document.documentElement.dataset.theme='light';window.scrollTo(0,0);await tick();check(getComputedStyle(document.querySelector('.mobile-app-shell')).backgroundColor==='rgb(244, 246, 250)','Light scoped page token');`)
  await screen('today-light-390')
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await run(`check([...document.querySelectorAll('.protocol-ring-named,summary')].every(e=>getComputedStyle(e).transitionDuration==='0s'&&getComputedStyle(e).animationName==='none'),'Reduced motion removes transitions');window.scrollTo(0,document.body.scrollHeight);await tick();const nav=document.querySelector('.app-tab-bar').getBoundingClientRect(),last=document.querySelector('main').getBoundingClientRect();check(nav.bottom<=innerHeight+1,'Bottom navigation in viewport');check(last.bottom<=nav.top,'Bottom content clears navigation');check(errors.length===0,'No runtime errors');`)
  }
  console.log('Checking Today loading deadlines and recovery')
  await run(`qaReset(1,'history',{}, {logs:[{compound_id:'c0',date:'2020-02-01',taken:true}]});qaJournal=[{id:'j-current',date:'2026-10-04',weight:180,energy:3,mood:4,hunger:null,sleep:null,notes:''},{id:'j-old',date:'2020-01-01',weight:200,energy:2,mood:3,sleep:7,notes:''}];await tick();await waitFor(()=>document.querySelector('.today-protocol-snapshot'));check(document.querySelector('[class$="_healthChange"]').textContent.includes('-20 lbs'),'Earliest historical weight remains part of weight change');check(document.querySelector('[class$="_healthChange"] time').getAttribute('datetime')==='2020-01-01','Weight baseline retains records older than arbitrary windows');check([...document.querySelectorAll('.today-health-metrics strong')].some(e=>e.textContent==='7 h'),'Latest non-null historic sleep value is preserved');const next=[...document.querySelectorAll('.today-snapshot-fact dt')].find(e=>e.textContent==='Next dose');check(next.nextElementSibling.textContent==='Due today','Old injection history still drives last-dose result');`)
  await run(`qaReset(5,'error');await tick();await waitFor(()=>button('Retry health'));check(button('Mark taken'),'Journal failure preserves critical dose actions');check(!document.querySelector('.today-error'),'Journal failure is section-local');check(!document.querySelector('header button[aria-label^="Current weight"]'),'Failed health does not present a fabricated weight');qaMode='full';button('Retry health').click();await waitFor(()=>button('Review check-in'));check(document.querySelector('header button[aria-label^="Current weight"]'),'Health retry restores trustworthy weight');`)
  await run(`qaReset(5,'full',{history:{fail:true}});await tick();await waitFor(()=>button('Retry history'));check(!document.querySelector('.today-weekly-schedule')&&!document.querySelector('.today-protocol-snapshot'),'Failed history never becomes an empty schedule or zero-inventory snapshot');check(button('Mark taken'),'Historical failure preserves essential actions');qaPolicy.history={};button('Retry history').click();await waitFor(()=>document.querySelector('.today-weekly-schedule'));check(document.querySelector('.today-protocol-snapshot'),'History retry restores detailed results');`)
  await run(`qaReset(5,'full',{planned:{fail:true}});await tick();await waitFor(()=>button('Retry planned protocols'));check(button('Mark taken'),'Planned-protocol failure preserves essential actions');qaPolicy.planned={};button('Retry planned protocols').click();await waitFor(()=>!button('Retry planned protocols'));`)
  await run(`qaReset(5,'full',{auth:{delay:30000}});await tick();await waitFor(()=>document.querySelector('.today-error'),12000);metrics.authDeadlineMs=Math.round(performance.now()-qaMountedAt);check(metrics.authDeadlineMs>=9500&&metrics.authDeadlineMs<11500,'Authentication deadline is approximately ten seconds');check(!qaRequests.some(r=>r.key==='active'),'Unverified authentication starts no protocol reads');check(button('Try again')&&!button('Mark taken'),'Stalled authentication has recovery without dose actions');qaPolicy.auth={};button('Try again').click();await waitFor(actionReady);check(button('Mark taken'),'Authentication deadline retry recovers');`)
  await run(`qaReset(5,'full',{today:{delay:30000}});await tick();await waitFor(()=>document.querySelector('.today-error'),12000);metrics.criticalDeadlineMs=Math.round(performance.now()-qaMountedAt);check(metrics.criticalDeadlineMs>=9500&&metrics.criticalDeadlineMs<11500,'Critical-read deadline is approximately ten seconds');check(qaRequests.some(r=>r.key==='today'&&r.aborted),'Critical deadline aborts the database request');check(!button('Mark taken'),'Unknown today logs never expose a scheduled-dose action');qaPolicy.today={};button('Try again').click();await waitFor(actionReady);`)
  await run(`qaReset(0,'empty',{ownership:{fail:true}},{userId:'fictional-ownership-failure',onboarding:true});await tick();await waitFor(()=>button('Try again'));check(qaNavigated==='','Ownership failure never triggers empty-account onboarding');check(!button('Mark taken'),'Ownership failure exposes no dose actions');qaReset(0,'empty',{}, {userId:'fictional-new-account',onboarding:true});await tick();await waitFor(()=>qaNavigated.includes('/protocol/manage'));check(qaNavigated.includes('new=1'),'Verified empty ownership opens existing onboarding');`)
  await run(`qaReset(5,'full',{auth:{fail:true}});await tick();await waitFor(()=>button('Try again'));check(![...document.querySelectorAll('a')].some(e=>e.textContent==='Sign in again'),'Authentication network failure is not presented as signed out');check(document.querySelector('.today-error').textContent.includes('Check your connection'),'Authentication network failure explains verification recovery');qaReset(5,'full',{auth:{result:{data:{user:null},error:null}}});await tick();await waitFor(()=>[...document.querySelectorAll('a')].some(e=>e.textContent==='Sign in again'));check(!button('Mark taken'),'Confirmed unauthenticated session has no dose actions');qaReset(5);await tick();await waitFor(actionReady);qaEmitAuth('SIGNED_OUT',null);await tick();check(!button('Mark taken')&&!document.querySelector('.today-protocol-snapshot'),'Sign-out clears prior account content');`)
  await run(`qaReset(5,'full',{active:{delay:450,ignoreAbort:true}});await tick();qaPolicy.active={};qaCount=1;qaEmitAuth('SIGNED_IN','fictional-next-account');await waitFor(()=>document.querySelectorAll('.protocol-ring-named').length===1);await new Promise(r=>setTimeout(r,500));check(document.querySelectorAll('.protocol-ring-named').length===1,'Late prior-account data cannot replace new account records');`)
  await run(`qaReset(5,'full',{today:{delay:450,ignoreAbort:true}},{logs:[{compound_id:'c0',date:'2026-10-04',taken:true}]});await tick();qaPolicy.today={};qaNow='2026-10-05T12:00:00';window.dispatchEvent(new Event('focus'));await waitFor(actionReady);await new Promise(r=>setTimeout(r,500));check(document.querySelector('progress').value===0,'Late previous-day logs cannot replace the new calendar day');check(document.querySelector('header time').getAttribute('datetime')==='2026-10-05','Calendar-day change refreshes the displayed date');`)
  await run(`qaReset(5);await tick();await waitFor(actionReady);window.loadingFlashes=0;window.loadingObserver=new MutationObserver(()=>{if(document.querySelector('.today-loading'))loadingFlashes++});loadingObserver.observe(document.getElementById('root'),{childList:true,subtree:true});qaRequests=[];qaPolicy.active={delay:250};for(let i=0;i<3;i++)window.dispatchEvent(new Event('doses_updated'));await new Promise(r=>setTimeout(r,400));check(qaRequests.filter(r=>r.key==='active').length===1,'Concurrent refresh events share one loading batch');check(loadingFlashes===0,'Silent dose refresh never flashes full-page loading');qaPolicy.active={};const mark=button('Mark taken');mark.click();mark.click();await tick();check(qaWrites.filter(w=>w.table==='injection_logs').length===1,'Rapid dose activation writes once');check(document.querySelector('progress').value===1,'Saved dose state remains visible');button('Review check-in').click();await tick();const notes=document.querySelector('[aria-label="Check-in notes"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(notes,'Fictional saved note');notes.dispatchEvent(new Event('input',{bubbles:true}));await tick();qaPolicy.journal={delay:400};const update=button('Update');update.click();update.click();await tick();check(qaWrites.filter(w=>w.table==='journal_entries').length===1,'Rapid journal save writes once');check(loadingFlashes===0,'Journal save never flashes full-page loading');button('Review check-in').click();await tick();const draft=document.querySelector('[aria-label="Check-in notes"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(draft,'Newer unsaved fictional draft');draft.dispatchEvent(new Event('input',{bubbles:true}));await new Promise(r=>setTimeout(r,500));check(document.querySelector('[aria-label="Check-in notes"]').value==='Newer unsaved fictional draft','Late journal refresh preserves newer user edits');check(document.querySelector('progress').value===1,'Journal refresh preserves saved dose status');check(loadingFlashes===0,'All save refreshes keep Today visible');loadingObserver.disconnect();check(errors.length===0,'No runtime errors after performance and recovery cases');`)
  await run(`qaReset(5,'full',{}, {logs:[{compound_id:'c0',date:'2026-10-04',taken:true}]});await tick();await waitFor(()=>document.querySelector('.today-protocol-snapshot'));button('Review check-in').click();await tick();const notes=document.querySelector('[aria-label="Check-in notes"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(notes,'Keep this draft during failed refresh');notes.dispatchEvent(new Event('input',{bubbles:true}));await tick();const previousWeight=document.querySelector('header button[aria-label^="Current weight"]').textContent,previousDetail=document.querySelector('.today-protocol-snapshot').textContent;qaPolicy.journal={fail:true};qaPolicy.history={fail:true};window.dispatchEvent(new Event('doses_updated'));await waitFor(()=>button('Retry health')&&button('Retry history'));check(document.querySelector('header button[aria-label^="Current weight"]').textContent===previousWeight,'Failed refresh retains previously loaded weight');check(document.querySelector('.today-protocol-snapshot').textContent===previousDetail,'Failed refresh retains previously loaded protocol history');check(document.querySelector('.today-weekly-schedule'),'Failed refresh retains the loaded schedule');check(document.querySelector('[aria-label="Check-in notes"]').value==='Keep this draft during failed refresh','Failed health refresh preserves the open draft');check(document.querySelector('[aria-label="Check-in notes"]').matches(':disabled'),'Failed health refresh disables uncertain check-in controls');check(document.querySelector('.today-weekly-schedule').closest('fieldset').disabled,'Failed history refresh disables schedule mutations');check(document.querySelector('progress').value===1&&button('Mark taken'),'Secondary refresh failures preserve saved dose state and critical actions');qaPolicy.journal={};qaPolicy.history={};button('Retry health').click();button('Retry history').click();await waitFor(()=>{const notes=document.querySelector('[aria-label="Check-in notes"]'),schedule=document.querySelector('.today-weekly-schedule');return !button('Retry health')&&!button('Retry history')&&notes&&!notes.matches(':disabled')&&schedule&&!schedule.closest('fieldset').disabled});check(!document.querySelector('[aria-label="Check-in notes"]').matches(':disabled'),'Health retry restores the existing panel controls');check(document.querySelector('[aria-label="Check-in notes"]').value==='Keep this draft during failed refresh','Successful section retry preserves the draft');`)
  await run(`qaReset(5);await tick();await waitFor(actionReady);button('Review check-in').click();await tick();const weight=[...document.querySelectorAll('#daily-checkin-panel label')].find(e=>e.textContent.startsWith('Weight (')).querySelector('input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(weight,'200');weight.dispatchEvent(new Event('input',{bubbles:true}));await tick();qaUnit='kg';window.dispatchEvent(new Event('doses_updated'));await tick();check(weight.value==='200'&&weight.closest('label').textContent==='Weight (lbs)','Remote profile refresh preserves the edited weight and its unit');`)
  await run(`qaReset(5,'full',{history:{delay:30000},'write:injection_logs':{delay:11000}});await tick();await waitFor(actionReady);const started=performance.now();button('Mark taken').click();await waitFor(()=>document.querySelector('main').textContent.includes('A save is still pending.'),12000);metrics.stalledWriteRecoveryMs=Math.round(performance.now()-started);check(metrics.stalledWriteRecoveryMs>=9500&&metrics.stalledWriteRecoveryMs<11500,'Secondary reads waiting for a stalled save recover within ten seconds: '+metrics.stalledWriteRecoveryMs+'ms');check(button('Retry history')&&button('Retry health'),'Stalled save gives section-specific recovery controls');check(!document.querySelector('.today-loading'),'Stalled save keeps the loaded Today screen visible');check(button('Saving…')?.disabled,'Uncertain save stays locked against duplicate writes');check(qaWrites.filter(w=>w.table==='injection_logs').length===1,'Stalled save does not repeat its mutation');qaPolicy.history={};await waitFor(()=>document.querySelector('.today-weekly-schedule')&&button('Mark taken'),2500);check(document.querySelector('progress').value===1,'Delayed save completion restores its saved dose state');check(!document.querySelector('main').textContent.includes('A save is still pending.'),'Delayed save completion clears bounded recovery notice');check(errors.length===0,'No runtime errors after refresh and stalled-save recovery');`)
  const report = { passed: (await run('return checks')).length, checks: await run('return checks'), metrics: await run('return metrics'), sourceHashes, screenshots, presentationMatrix, errors: await run('return errors'), fixture: 'Actual Today Page and AppShell with fictional mocked Supabase, Next navigation and PWA registration; CSS Modules transformed locally; no Next production build or live backend verification.' }
  const reportPath = path.join(dir, performanceOnly ? 'today-performance-after.json' : 'today-browser.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: report.passed, metrics: report.metrics, screenshots, report: reportPath }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { ws?.close(); chrome?.kill(); server?.close(); clearTimeout(deadline) })
