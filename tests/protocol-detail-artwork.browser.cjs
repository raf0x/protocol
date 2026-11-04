// Actual ProtocolDetail + production CSS, synthetic data, no live backend.
// Run: npm run validate:browser -- tests/protocol-detail-artwork.browser.cjs
// Optional: RELEASE3_EVIDENCE_DIR overrides the permanent evidence destination.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const cp = require('node:child_process'), http = require('node:http')
const root = process.cwd(), canonical = path.resolve(root, '../MyPepProtocol-Dev')
const toolRequire = require('node:module').createRequire(path.join(fs.existsSync(path.join(root, 'node_modules/typescript')) ? root : canonical, 'package.json'))
const WebSocket = toolRequire('next/dist/compiled/ws')
const sha256 = data => require('node:crypto').createHash('sha256').update(data).digest('hex')
const evidence = process.env.RELEASE3_EVIDENCE_DIR || path.resolve(root, '../Release-3-Visual-Review/release3a-20261104/final-correction-20261104')
fs.mkdirSync(evidence, { recursive: true })
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'release3a-browser-runtime-'))
const sourceHashes = { 'tests/protocol-detail-artwork.browser.cjs': sha256(fs.readFileSync(__filename)) }, screenshots = [], videos = [], checks = [], matrix = [], mobileLayouts = [], semanticBaselines = {}
const baseline = '7bdb38b884da951a9d53831be1486f6cecf1a184'
const contexts = [
  ['recorded', 'injection'], ['im', 'injection'], ['oral', 'oral'], ['oral-stale', 'oral'],
  ['missing-route', null], ['missing-route-injection', 'injection'], ['entry-injection', 'injection'],
  ['entry-volume', 'injection'], ['derived-only', null], ['other', null], ['topical', null],
  ['missing', null], ['unknown', 'injection'], ['zero', 'injection'], ['multiple', 'injection'], ['long', 'injection'],
]
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let chrome, ws, server
const deadline = setTimeout(() => { console.error('Release 3A browser deadline exceeded'); process.exit(1) }, 180000)
const entry = path.join(runtime, 'fixture.tsx')
fs.writeFileSync(entry, [
  "import React from 'react'; import {createRoot} from 'react-dom/client';",
  'import ProtocolDetail from ' + JSON.stringify(path.join(root, 'components/protocols/ProtocolDetail.tsx')) + ';',
  "window.qaWrites=[];window.qaRequests=[];window.qaActions=[];",
  String.raw`
  window.qaProtocol=(mode='recorded')=>({
    id:'synthetic-protocol',name:'Example protocol',status:'active',start_date:'2026-11-01',
    compounds:Array.from({length:mode==='multiple'?2:1},(_,index)=>{
      const phase={id:'synthetic-phase-'+index,start_week:1,end_week:null,dose:1,dose_unit:'mg',
        dose_semantics_version:1,frequency:'daily',route:'SubQ',injection_volume_ml:0.2,syringe_units:20,
        syringe_scale:100,time_of_day:'Morning',days_of_week:[0,1,2,3,4,5,6]};
      const entry={version:2,mode:'medication',review_status:'confirmed',dose:'1',dose_unit:'mg',
        syringe_markings:'',syringe_scale:'100',injection_volume:'',vial_strength:'',vial_unit:'',bac_water_ml:'',
        preparation:'ready',concentration_value:'5',concentration_unit:'mg/mL',vial_label:''};
      if(mode==='im')phase.route='IM';
      if(mode==='oral'||mode==='oral-stale')phase.route='Oral';
      if(mode==='other')phase.route='Other';
      if(mode==='topical')phase.route='Topical';
      if(['missing-route','missing-route-injection','entry-injection','entry-volume','derived-only'].includes(mode))delete phase.route;
      if(['oral','missing-route','entry-injection','entry-volume'].includes(mode)){
        phase.injection_volume_ml=null;phase.syringe_units=null;
      }
      if(mode==='entry-injection')phase.dosing_entry={...entry,mode:'syringe',dose:'',dose_unit:'',syringe_markings:'8',syringe_scale:'40'};
      if(mode==='entry-volume')phase.dosing_entry={...entry,mode:'volume',dose:'',dose_unit:'',injection_volume:'0.2'};
      // Saved equivalents and the default syringe scale cannot establish injection context.
      if(mode==='derived-only')phase.dosing_entry=entry;
      return {id:'synthetic-compound-'+index,
        name:mode==='long'?'Synthetic compound with a deliberately long recorded identity / combination name':'Example compound',
        vial_strength:10,vial_unit:'mg',bac_water_ml:2,vials_in_stock:mode==='unknown'?null:mode==='zero'?0:3,
        notes:'Synthetic review data. No real treatment.',phases:mode==='missing'?[]:[phase]};
    })
  });`,
  "const noop=(action)=>(()=>qaActions.push(action));",
  "function Fixture(){const [state,setState]=React.useState({mode:'recorded',version:0});React.useEffect(()=>{window.qaReset=mode=>{qaRequests=[];qaWrites=[];qaActions=[];setState(old=>({mode,version:old.version+1}))}},[]);const protocol=React.useMemo(()=>qaProtocol(state.mode),[state.mode,state.version]);return <main className='protocols-page'><ProtocolDetail key={state.version} protocol={protocol} today='2026-11-04' onBack={noop('back')} onEdit={noop('edit')} onComplete={noop('complete')} onPause={noop('pause')} onResume={noop('resume')} onReactivate={noop('reactivate')} onDelete={noop('delete')} onReload={noop('reload')}/></main>}",
  "createRoot(document.getElementById('root')).render(<Fixture/>);"
].join('\n'))

function htmlFor(before) {
  const ts = toolRequire('typescript')
  const modules = [], ids = new Map(), styles = [], globals = []
  function resolve(specifier, importer) {
    const base = specifier.startsWith('.') ? path.resolve(path.dirname(importer), specifier) : specifier
    for (const suffix of ['', '.ts', '.tsx', '.js']) {
      try { return toolRequire.resolve(base + suffix, { paths: [path.dirname(importer), root, canonical] }) } catch {}
    }
    throw Error('Cannot resolve ' + specifier + ' from ' + importer)
  }
  function bundle(file) {
    if (ids.has(file)) return ids.get(file)
    const id = modules.length; ids.set(file, id); modules.push(null)
    let code = fs.readFileSync(file, 'utf8')
    const relative = path.relative(root, file).replaceAll('\\', '/')
    if (before && relative === 'components/protocols/ProtocolDetail.tsx') code = cp.execFileSync('git', ['show', baseline + ':' + relative], { cwd: root, encoding: 'utf8', windowsHide: true })
    if (!relative.startsWith('..') && !relative.startsWith('node_modules')) sourceHashes[(before ? 'before:' : 'after:') + relative] = sha256(code)
    if (file === path.join(root, 'lib/supabase.ts')) code = String.raw`
      exports.createClient=()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}},error:null})},from:table=>{
        const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},insert(v){qaWrites.push({table,v});throw Error('Unexpected write')},update(v){qaWrites.push({table,v});throw Error('Unexpected write')},delete(){qaWrites.push({table});throw Error('Unexpected write')},then(resolve,reject){qaRequests.push(table);return Promise.resolve({data:[],error:null}).then(resolve,reject)}};return q}});
    `
    if (file.endsWith('.module.css')) {
      const names = {}, globalNames = []
      let css = code.replace(/:global\(([^)]+)\)/g, (_, value) => 'GLOBALTOKEN' + (globalNames.push(value) - 1))
      css = css.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => '.' + (names[name] = 'm' + id + '_' + name))
      styles.push(css.replace(/GLOBALTOKEN(\d+)/g, (_, i) => globalNames[i])); code = 'module.exports=' + JSON.stringify(names)
    } else if (file.endsWith('.css')) { globals.push(code); code = 'module.exports={}' }
    if (/\.(tsx?|m?js)$/.test(file)) code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    const map = {}
    for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
      if (require('node:module').isBuiltin(match[1])) throw Error('Unexpected browser builtin: ' + match[1])
      const dep = JSON.parse('"' + match[1] + '"'); map[dep] = bundle(resolve(dep, file))
    }
    modules[id] = 'function(module,exports){const require=name=>load(' + JSON.stringify(map) + '[name]);' + code + '\n}'
    return id
  }
  const id = bundle(entry)
  const script = "const process={env:{NODE_ENV:'production'}};const modules=[" + modules.join(',') + "],cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports);return module.exports}load(" + id + ');'
  const css = ['app/globals.css', 'app/mobile-app.css', 'app/protocol/manage/protocols.css'].map(file => { const code = fs.readFileSync(path.join(root, file), 'utf8'); sourceHashes[file] = sha256(code); return code }).concat(globals, styles).join('\n')
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Release 3A synthetic Protocol Detail — ' + (before ? 'before' : 'after') + '</title><style>' + css + '\n*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:var(--app-bg);color:var(--app-text)}.protocols-page{padding:18px 16px 32px;max-width:760px;margin:auto}</style></head><body><div id="root"></div><script>window.errors=[];window.onerror=(...args)=>errors.push(args.slice(0,3));window.onunhandledrejection=e=>errors.push(String(e.reason));window.fetch=()=>{throw Error("Unexpected real network request")};window.XMLHttpRequest=function(){throw Error("Unexpected real network request")};</script><script>' + script.replaceAll('</script', '<\\/script') + '</script></body></html>'
}

function installChecks() {
  window.check = (ok, label) => { if (!ok) throw Error(label); window.qaChecks.push(label) }
  window.qaChecks = []
  window.tick = ms => new Promise(resolve => setTimeout(resolve, ms || 80))
  window.waitFor = async predicate => { for (let i = 0; i < 100; i++) { if (predicate()) return; await tick(20) } throw Error('Fixture condition timeout: '+JSON.stringify(window.errors)+' body='+document.body.innerText.slice(0,500)) }
  window.openDetails = async () => { const details = document.querySelector('.protocol-more-details'); details.open = true; await tick(); }
  window.artSection = kind => document.querySelector('[data-protocol-artwork-section="' + kind + '"]')
  window.art = kind => document.querySelector('[data-protocol-artwork-svg="' + kind + '"]')
  window.replay = kind => document.querySelector('button[aria-label="Replay ' + kind[0].toUpperCase() + kind.slice(1) + ' illustration"]')
  window.qaContrast = element => {
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { willReadFrequently: true })
    canvas.width = canvas.height = 1
    const color = value => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); const values = [...context.getImageData(0, 0, 1, 1).data]; return [...values.slice(0, 3), values[3] / 255] }
    const blend = (a, b) => [...a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3])), 1]
    const backgrounds = e => {
      if (!e) return [[255, 255, 255, 1]]
      const s = getComputedStyle(e), base = backgrounds(e.parentElement).map(b => blend(color(s.backgroundColor), b))
      const stops = s.backgroundImage === 'none' ? [] : s.backgroundImage.match(/(?:rgba?|color)\([^)]*\)|#[\da-f]{3,8}\b|transparent/gi)
      if (s.backgroundImage !== 'none' && !stops?.length) throw Error('Unsupported gradient for contrast: ' + s.backgroundImage)
      return stops?.length ? base.flatMap(b => stops.map(stop => blend(color(stop), b))) : base
    }
    const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0)
    return Math.min(...backgrounds(element).map(bg => { const a = luminance(blend(color(getComputedStyle(element).color), bg)), b = luminance(bg); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }))
  }
  window.qaSemanticSnapshot = () => {
    const clone = document.querySelector('.protocol-detail').cloneNode(true)
    clone.querySelectorAll('[data-protocol-artwork]').forEach(element => element.remove())
    const text = element => element?.textContent.replace(/\s+/g, ' ').trim() ?? ''
    // Release 3A already moved Inventory out of Plan; compare facts, not that earlier section order.
    return JSON.stringify({
      header: text(clone.querySelector('.protocol-detail-header')),
      compounds: [...clone.querySelectorAll('.protocol-detail-compound')].map(text),
      administration: [...clone.querySelectorAll('.protocol-more-section')].filter(e => e.querySelector('h3')?.textContent === 'Administration').map(text),
      facts: [...clone.querySelectorAll('dt')].map(e => [text(e), text(e.nextElementSibling)]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
      warnings: [...clone.querySelectorAll('[role="status"]')].map(text),
      controls: [...clone.querySelectorAll('button,summary')].map(e => [text(e), e.getAttribute('aria-label'), e.hasAttribute('disabled')]),
      history: text(clone.querySelector('.protocol-history-disclosure')),
      actions: text(clone.querySelector('.protocol-advanced')),
    })
  }
  window.qaInventoryGeometry = () => art('inventory').outerHTML.replace(/protocol-art-[^"\s()]+-(glass|color|metal|halo|edge|plinth)/g, 'protocol-art-ID-$1')
  window.qaLayout = (label, administration = 'injection') => {
    check(document.documentElement.scrollWidth <= innerWidth, label + ' no page horizontal overflow')
    for (const kind of ['administration', 'inventory']) {
      const section = artSection(kind), svg = art(kind), figure = svg?.closest('figure'), caption = figure?.querySelector('figcaption'), button = replay(kind)
      check(Boolean(section), label + ' actual ' + kind + ' section exists')
      if (kind === 'administration' && administration === null) {
        check(!svg && !figure && !button && !section.querySelector('figure'), label + ' unknown or unsupported Administration has no artwork or replay')
        check(section.dataset.administrationArtwork === 'none', label + ' data-only Administration is explicitly compact')
      } else {
        check(Boolean(svg && figure && caption && button), label + ' actual ' + kind + ' artwork and caption exist')
        check(svg.getAttribute('aria-hidden') === 'true' && svg.getAttribute('focusable') === 'false', label + ' decorative ' + kind + ' SVG excluded from accessibility tree')
        check(caption.textContent.includes(kind === 'administration' ? 'not a dose guide' : 'not a stock count'), label + ' explicit illustrative qualifier ' + kind)
        const box = svg.getBoundingClientRect(), bounds = section.getBoundingClientRect()
        check(box.width >= 100 && box.height >= 60 && box.left >= bounds.left - 1 && box.right <= bounds.right + 1, label + ' artwork responsive and unclipped ' + kind)
        const touch = button.getBoundingClientRect()
        check(touch.width >= 44 && touch.height >= 44, label + ' replay touch target ' + kind)
        check(qaContrast(caption) >= 4.5, label + ' caption contrast at least 4.5:1 ' + kind)
        if (kind === 'administration') {
          check(figure.dataset.administrationArtwork === administration, label + ' correct recorded Administration context')
          check(Boolean(svg.querySelector('[data-motion="syringe"]')) === (administration === 'injection'), label + ' syringe only for recorded injection context')
          if (administration === 'oral') check(Boolean(svg.querySelector('[data-motion="capsule"]')), label + ' Oral reuses approved capsule artwork')
        }
      }
      for (const element of section.querySelectorAll('h3,dt,dd,p')) {
        check(qaContrast(element) >= 4.5, label + ' readable section text contrast ' + kind + ' ' + element.tagName)
        check(parseFloat(getComputedStyle(element).fontSize) >= 14, label + ' section data text remains at least 14px ' + kind)
      }
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT)
      for (let node; (node = walker.nextNode());) {
        if (!node.textContent.trim() || node.parentElement.closest('svg')) continue
        const range = document.createRange(); range.selectNodeContents(node)
        for (const rect of range.getClientRects()) if (rect.width && rect.height) check(rect.left >= 0 && rect.right <= innerWidth + 1, label + ' visible text contained ' + kind)
      }
    }
    const ids = [...document.querySelectorAll('svg [id]')].map(e => e.id)
    check(new Set(ids).size === ids.length, label + ' unique SVG IDs')
    for (const svg of document.querySelectorAll('[data-protocol-artwork]')) for (const e of svg.querySelectorAll('*')) for (const attr of e.attributes) {
      for (const ref of attr.value.matchAll(/url\(#([^)]+)\)/g)) check(Boolean(svg.querySelector('[id="' + ref[1] + '"]')), label + ' local SVG reference ' + ref[1])
    }
    check(qaWrites.length === 0 && qaActions.length === 0, label + ' no writes or treatment actions')
    check(errors.length === 0, label + ' no browser runtime errors')
  }
}

// Generate fixtures in an owned short-lived process so TypeScript's heap is released before Chrome starts.
if (process.argv.includes('--build-fixtures')) {
  console.log('Bundling actual ProtocolDetail fixtures')
  const pages = { '/before': htmlFor(true), '/after': htmlFor(false) }
  fs.writeFileSync(path.join(evidence, 'before-fixture.html'), pages['/before'])
  fs.writeFileSync(path.join(evidence, 'after-fixture.html'), pages['/after'])
  fs.writeFileSync(path.join(evidence, 'fixture-source-hashes.json'), JSON.stringify({ baseline, sourceHashes, entryHash: sha256(fs.readFileSync(entry)), artifacts: Object.fromEntries(Object.entries(pages).map(([stage, html]) => [stage, sha256(html)])) }, null, 2))
  clearTimeout(deadline)
  process.exit(0)
}

;(async () => {
  if (process.env.RELEASE3_REUSE_FIXTURES !== '1') cp.execFileSync(process.execPath, ['--max-old-space-size=256', __filename, '--build-fixtures'], { cwd: root, windowsHide: true, stdio: 'inherit', timeout: 60000 })
  const fixture = JSON.parse(fs.readFileSync(path.join(evidence, 'fixture-source-hashes.json'), 'utf8'))
  if (fixture.baseline !== baseline || fixture.entryHash !== sha256(fs.readFileSync(entry))) throw Error('Fixture identity does not match this run')
  for (const [name, expected] of Object.entries(fixture.sourceHashes)) {
    if (name === 'tests/protocol-detail-artwork.browser.cjs') continue // Assertion harness is hashed separately; fixture input/source hashes must still match.
    const code = name === 'before:components/protocols/ProtocolDetail.tsx' ? cp.execFileSync('git', ['show', baseline + ':' + name.slice(7)], { cwd: root, windowsHide: true }) : fs.readFileSync(path.join(root, name.replace(/^(before|after):/, '')))
    if (sha256(code) !== expected) throw Error('Source changed after fixture generation: ' + name)
  }
  for (const [name, value] of Object.entries(fixture.sourceHashes)) if (name !== 'tests/protocol-detail-artwork.browser.cjs') sourceHashes[name] = value
  const pages = { '/before': fs.readFileSync(path.join(evidence, 'before-fixture.html'), 'utf8'), '/after': fs.readFileSync(path.join(evidence, 'after-fixture.html'), 'utf8') }
  for (const [stage, html] of Object.entries(pages)) if (sha256(html) !== fixture.artifacts[stage]) throw Error('Fixture artifact integrity mismatch: ' + stage)
  console.log('Fixture source, entry and artifact hashes verified; CDP process has no TypeScript heap')
  server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(pages[req.url?.split('?')[0]] || '') })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  chrome = cp.spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(runtime, 'profile'), 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
  chrome.stderr.on('data', data => fs.appendFileSync(path.join(evidence, 'chrome-stderr.log'), data))
  let port
  for (let i = 0; i < 100; i++) { try { port = fs.readFileSync(path.join(runtime, 'profile/DevToolsActivePort'), 'utf8'); if (port.includes('/devtools/')) break } catch {} await sleep(100) }
  if (!port) throw Error('Chrome did not start')
  const targets = await (await fetch('http://127.0.0.1:' + port.split('\n')[0] + '/json', { signal: AbortSignal.timeout(10000) })).json()
  ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let seq = 0, recording = null; const pending = new Map()
  ws.onmessage = event => {
    const message = JSON.parse(event.data)
    if (/crash/i.test(message.method || '')) console.error('Chrome CDP event: ' + JSON.stringify(message))
    if (message.id) { const job = pending.get(message.id); if (!job) return; clearTimeout(job.timer); pending.delete(message.id); message.error ? job.reject(message.error) : job.resolve(message.result) }
    if (message.method === 'Page.screencastFrame') { if (recording) recording.push({ data: message.params.data, timestamp: message.params.metadata.timestamp }); void cdp('Page.screencastFrameAck', { sessionId: message.params.sessionId }) }
  }
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq, timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)) }, 30000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })) })
  const run = async code => { const result = await cdp('Runtime.evaluate', { expression: '(async()=>{' + code + '})()', awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
  const harvest = async () => { checks.push(...await run('return window.qaChecks||[]')); await run('window.qaChecks=[]') }
  const viewport = (width, height = 844) => cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 })
  let navigation = 0
  const navigate = async (stage, theme) => { console.log('Browser scenario: ' + stage + ' / ' + theme)
    const url = 'http://127.0.0.1:' + server.address().port + '/' + stage + '?qaNavigation=' + (++navigation)
    await cdp('Page.navigate', { url })
    let ready = false
    // Poll the new document synchronously; an awaited promise in the outgoing document can be destroyed by navigation.
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        const status = await cdp('Runtime.evaluate', { expression: 'location.href===' + JSON.stringify(url) + '&&document.readyState==="complete"&&typeof window.qaReset==="function"', returnByValue: true })
        if (status.result?.value === true) { ready = true; break }
      } catch (error) {
        if (!/context|navigat/i.test(String(error.message || error))) throw error
      }
      await sleep(50)
    }
    if (!ready) throw Error('New fixture document did not become ready: ' + stage + ' / ' + theme)
    console.log('Fixture document ready: ' + stage + ' / ' + theme)
    await run('document.documentElement.dataset.theme=' + JSON.stringify(theme) + ';(' + installChecks.toString() + ')();')
    console.log('Fixture checks installed: ' + stage + ' / ' + theme)
    await run('await openDetails();')
    console.log('Fixture details expanded: ' + stage + ' / ' + theme)
  }
  const screen = async (name, full = false) => {
    const metrics = full ? await cdp('Page.getLayoutMetrics') : null
    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, width: metrics.cssContentSize.width, height: metrics.cssContentSize.height, scale: 1 } } : {}) })
    const file = path.join(evidence, name + '.png'); fs.writeFileSync(file, Buffer.from(shot.data, 'base64')); screenshots.push(file)
  }
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  for (const theme of ['dark', 'light']) {
    await viewport(390); await navigate('before', theme)
    await screen('before-mobile-390-' + theme, true)
    await run("check(qaRequests.length===2,'Baseline performs only two existing history reads');check(qaWrites.length===0,'Baseline fixture performs no writes');")
    await harvest()
    if (theme === 'dark') for (const [mode] of contexts) {
      console.log('Baseline semantic snapshot: ' + mode)
      semanticBaselines[mode] = await run('qaReset(' + JSON.stringify(mode) + ');await tick();await openDetails();return qaSemanticSnapshot();')
    }
  }

  // Dedicated correction evidence at the requested iPhone-sized viewport.
  for (const theme of ['dark', 'light']) {
    await viewport(390); await navigate('after', theme)
    const injectableHeight = await run("return artSection('administration').getBoundingClientRect().height")
    const injectableExpandedHeight = await run("return document.querySelector('.protocol-more-details').getBoundingClientRect().height")
    for (const [mode, state, kind, context] of [
      ['oral', 'oral', 'administration', 'oral'],
      ['missing-route', 'unknown-administration', 'administration', null],
      ['unknown', 'unknown-inventory', 'inventory', 'injection'],
    ]) {
      await run('qaReset(' + JSON.stringify(mode) + ');await tick();await openDetails();artSection(' + JSON.stringify(kind) + ").scrollIntoView({block:'center'});await tick(1100);qaLayout(" + JSON.stringify(theme + ' correction ' + state + ' 390px') + ',' + JSON.stringify(context) + ');')
      const layout = await run("return {administrationHeight:artSection('administration').getBoundingClientRect().height,expandedHeight:document.querySelector('.protocol-more-details').getBoundingClientRect().height,viewportWidth:innerWidth,scrollWidth:document.documentElement.scrollWidth}")
      await run('check(' + layout.administrationHeight + '<=' + (injectableHeight + 1) + ',' + JSON.stringify(state + ' Administration does not increase mobile height') + ');check(' + layout.expandedHeight + '<=' + (injectableExpandedHeight + 1) + ',' + JSON.stringify(state + ' expanded details do not grow unnecessarily') + ');')
      if (context === null) await run("check(artSection('administration').getBoundingClientRect().height<=110,'Unknown Administration has no reserved artwork-height gap');")
      mobileLayouts.push({ theme, state, ...layout, injectableHeight, injectableExpandedHeight })
      await screen('correction-mobile-390-' + theme + '-' + state)
      await run('scrollTo(0,0)'); await screen('correction-expanded-390-' + theme + '-' + state, true)
      await harvest()
    }
  }

  // A one-pixel edge intersection must not spend the entrance offscreen.
  await viewport(390); await navigate('after', 'dark')
  await run("document.getElementById('root').style.paddingTop='1000px';scrollTo(0,0);qaReset('recorded');await tick();await openDetails();window.edgeFigure=art('administration').closest('figure');window.edgeTop=edgeFigure.getBoundingClientRect().top+scrollY;scrollTo(0,edgeTop-innerHeight+1);await tick(180);check(!edgeFigure.hasAttribute('data-playing'),'First one-pixel intersection keeps entrance pending');check(!art('administration').getAnimations({subtree:true}).some(a=>a.playState==='running'),'First edge does not animate offscreen');scrollBy(0,Math.ceil(edgeFigure.getBoundingClientRect().height*.5));await tick(100);check(edgeFigure.getAttribute('data-playing')==='true','Entrance starts when at least 35 percent visible');check(art('administration').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Visible first entry runs actual SVG motion');await tick(1100);document.getElementById('root').style.paddingTop='';")
  await harvest()
  for (const theme of ['dark', 'light']) for (const width of [320, 375, 390, 430, 768]) {
    console.log('Viewport: ' + width); await viewport(width); await navigate('after', theme)
    await run("artSection('administration').scrollIntoView({block:'center'});await tick(1100);artSection('inventory').scrollIntoView({block:'center'});await tick(1100);qaLayout(" + JSON.stringify(theme + ' ' + width + 'px') + ");check(qaRequests.length===2,'Artwork adds no backend reads');")
    if (width === 390) {
      await run('scrollTo(0,0)'); await screen('after-mobile-390-' + theme, true)
      for (const kind of ['administration', 'inventory']) {
        await run('artSection(' + JSON.stringify(kind) + ").scrollIntoView({block:'center'});await tick();")
        await screen('after-mobile-390-' + theme + '-' + kind)
      }
    }
    matrix.push({ theme, width, passed: true }); await harvest()
  }
  await viewport(390); await navigate('after', 'dark')
  await run("artSection('administration').scrollIntoView({block:'center'});await tick(1100);window.savedIds=[...document.querySelectorAll('[data-protocol-artwork] [id]')].map(e=>e.id);window.savedRequests=qaRequests.length;")
  for (const kind of ['administration', 'inventory']) {
    await run("artSection('" + kind + "').scrollIntoView({block:'center'});await tick(1100);replay('" + kind + "').click();await tick(100);check(art('" + kind + "').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Actual " + kind + " SVG animates on replay');check(art('" + kind + "').getAnimations({subtree:true}).every(a=>a.effect.getTiming().iterations!==Infinity),'All " + kind + " animation iterations finite');await tick(1200);check(!art('" + kind + "').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Actual " + kind + " SVG settles');check(JSON.stringify([...document.querySelectorAll('[data-protocol-artwork] [id]')].map(e=>e.id))===JSON.stringify(savedIds),'Stable IDs through " + kind + " replay');")
    await run("window.qaFocusTarget=replay('" + kind + "');const controls=[...document.querySelectorAll('button,summary,a[href],input')].filter(e=>e.tabIndex>=0&&e.getClientRects().length&&!e.disabled);controls[controls.indexOf(qaFocusTarget)-1].focus();")
    for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await run("check(document.activeElement===qaFocusTarget&&qaFocusTarget.matches(':focus-visible'),'Keyboard Tab reaches " + kind + " replay');check(parseFloat(getComputedStyle(qaFocusTarget).outlineWidth)>=2,'Visible keyboard focus " + kind + "');")
    for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) })
    await run("await tick(100);check(art('" + kind + "').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Keyboard Enter replays " + kind + "');await tick(1100);")
  }
  await run("check(qaRequests.length===savedRequests&&qaWrites.length===0&&qaActions.length===0,'Replays and keyboard never read/write or trigger treatment actions');")
  await harvest()
  const inventoryGeometry = await run('return qaInventoryGeometry()')
  for (const [mode, context] of contexts) {
    await run('qaReset(' + JSON.stringify(mode) + ');await tick();await openDetails();')
    await run("artSection('inventory').scrollIntoView({block:'center'});await tick(1100);qaLayout(" + JSON.stringify(mode) + ',' + JSON.stringify(context) + ');')
    const semantics = await run('return qaSemanticSnapshot()')
    if (semantics !== semanticBaselines[mode]) fs.writeFileSync(path.join(evidence, 'semantic-parity-failure.json'), JSON.stringify({mode, baseline:JSON.parse(semanticBaselines[mode]), actual:JSON.parse(semantics)}, null, 2))
    await run('check(qaSemanticSnapshot()===' + JSON.stringify(semanticBaselines[mode]) + ',' + JSON.stringify(mode + ' preserves all baseline values, units, warnings and non-artwork controls') + ');check(qaInventoryGeometry()===' + JSON.stringify(inventoryGeometry) + ',' + JSON.stringify(mode + ' preserves Inventory SVG geometry and materials') + ");check(qaRequests.length===2,'Context selection adds no backend reads');")
    if (mode === 'unknown') await run("check(artSection('inventory').textContent.includes('Not recorded'),'Unknown inventory remains unknown');")
    if (mode === 'zero') await run("check(artSection('inventory').textContent.includes('0 vials in stock'),'Known zero inventory stays zero');")
    if (mode === 'oral') await run("check(artSection('administration').textContent.includes('Oral'),'Oral route preserved');check(!artSection('administration').textContent.includes('Syringe draw'),'Oral data has no invented syringe amount');")
    if (mode === 'oral-stale') await run("check(artSection('administration').textContent.includes('20 U-100 units'),'Explicit Oral preserves existing recorded syringe data without drawing syringe artwork');")
    if (mode === 'missing' || mode === 'missing-route') await run("check(artSection('administration').textContent.includes('Not recorded'),'Missing administration remains unknown');")
    if (mode === 'multiple') await run("check(document.querySelectorAll('[data-protocol-artwork]').length===4,'Multiple compounds have four independent artworks');")
    await harvest()
  }
  await navigate('after', 'dark')
  await run("qaReset('oral');await tick();await openDetails();artSection('administration').scrollIntoView({block:'center'});await tick(1100);window.oralIds=[...art('administration').querySelectorAll('[id]')].map(e=>e.id);window.qaFocusTarget=replay('administration');const controls=[...document.querySelectorAll('button,summary,a[href],input')].filter(e=>e.tabIndex>=0&&e.getClientRects().length&&!e.disabled);controls[controls.indexOf(qaFocusTarget)-1].focus();")
  for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
  await run("check(document.activeElement===qaFocusTarget&&qaFocusTarget.matches(':focus-visible'),'Keyboard Tab reaches Oral capsule replay');check(parseFloat(getComputedStyle(qaFocusTarget).outlineWidth)>=2,'Visible keyboard focus Oral capsule');")
  for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) })
  await run("await tick(100);check(art('administration').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Oral capsule has actual finite replay motion');check(art('administration').getAnimations({subtree:true}).every(a=>a.effect.getTiming().iterations!==Infinity),'Oral capsule has no continuous motion');await tick(1100);check(!art('administration').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Oral capsule settles');check(JSON.stringify([...art('administration').querySelectorAll('[id]')].map(e=>e.id))===JSON.stringify(oralIds),'Oral SVG IDs stable through keyboard replay');check(qaRequests.length===2&&qaWrites.length===0&&qaActions.length===0,'Oral replay never reads/writes or triggers treatment actions');")
  await harvest()
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await run("qaReset('recorded');await tick();await openDetails();")
  for (const kind of ['administration', 'inventory']) await run("artSection('" + kind + "').scrollIntoView({block:'center'});await tick();check(!art('" + kind + "').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Reduced motion immediately settled " + kind + "');check(getComputedStyle(replay('" + kind + "')).display==='none','Reduced motion hides replay control " + kind + "');if(!replay('" + kind + "').disabled)replay('" + kind + "').click();await tick();check(!art('" + kind + "').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Reduced motion replay stays still " + kind + "');")
  await screen('after-mobile-390-dark-reduced-motion', true); await harvest()
  await run("qaReset('oral');await tick();await openDetails();artSection('administration').scrollIntoView({block:'center'});await tick();check(!art('administration').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Reduced motion Oral capsule immediately settled');check(getComputedStyle(replay('administration')).display==='none','Reduced motion hides Oral replay');replay('administration').click();await tick();check(!art('administration').getAnimations({subtree:true}).some(a=>a.playState==='running'),'Reduced motion Oral replay stays still');")
  await harvest()
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] })
  await run("qaReset('recorded');await tick();await openDetails();")
  if (process.env.RELEASE3_CAPTURE_VIDEO === '1') for (const kind of ['administration', 'inventory']) {
    await run("artSection('" + kind + "').scrollIntoView({block:'center'});await tick(1100);")
    recording = []
    await cdp('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 390, maxHeight: 844, everyNthFrame: 1 })
    await sleep(100)
    await run("replay('" + kind + "').click()")
    await sleep(1500)
    await cdp('Page.stopScreencast')
    const frames = recording; recording = null
    fs.writeFileSync(path.join(evidence, kind + '-motion-frames.json'), JSON.stringify(frames))
    if (frames.length < 3 || new Set(frames.map(frame => frame.data)).size < 3) throw Error('Insufficient distinct actual animation frames for ' + kind)
    const video = await run('const frames=' + JSON.stringify(frames) + String.raw`;const canvas=document.createElement('canvas');canvas.width=390;canvas.height=844;const ctx=canvas.getContext('2d');const stream=canvas.captureStream(30);const type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)return null;const recorder=new MediaRecorder(stream,{mimeType:type}),chunks=[];recorder.ondataavailable=e=>chunks.push(e.data);const done=new Promise(resolve=>recorder.onstop=resolve);recorder.start();const start=performance.now();for(const frame of frames){const target=(frame.timestamp-frames[0].timestamp)*1000;const delay=target-(performance.now()-start);if(delay>0)await tick(delay);const img=new Image();img.src='data:image/jpeg;base64,'+frame.data;await img.decode();ctx.drawImage(img,0,0,390,844)}await tick(500);recorder.stop();await done;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type});const buffer=await blob.arrayBuffer();let binary='';for(const byte of new Uint8Array(buffer))binary+=String.fromCharCode(byte);return {data:btoa(binary),type,frames:frames.length,duration:(frames.at(-1).timestamp-frames[0].timestamp)*1000+500};`)
    if (video) { const file = path.join(evidence, kind + '-animation.webm'); fs.writeFileSync(file, Buffer.from(video.data, 'base64')); videos.push({ file, frames: video.frames, durationMs: video.duration, encoding: video.type, source: 'Chrome CDP screencast frames of actual replay, retained timestamps' }) }
  }
  await run("check(errors.length===0,'No runtime errors after all scenarios');check(qaWrites.length===0,'No writes after all scenarios');")
  await harvest()
  const report = { passed: true, assertionCount: checks.length, baseline, sourceHashes, fixtureArtifacts: fixture.artifacts, fixtureGeneratorHash: fixture.sourceHashes['tests/protocol-detail-artwork.browser.cjs'], reusedFixtures: process.env.RELEASE3_REUSE_FIXTURES === '1', videoCapture: process.env.RELEASE3_CAPTURE_VIDEO === '1' ? 'requested' : 'not repeated for focused correction; prior release videos preserved', matrix, mobileLayouts, contexts, checks, screenshots, videos, errors: await run('return errors'), scope: 'Actual hydrated ProtocolDetail and production CSS with synthetic data and module-boundary Supabase replacement. CSS Modules transformed locally. Headless Chrome mobile emulation; not physical iPhone/Safari or a live backend. No dependencies added.' }
  fs.writeFileSync(path.join(evidence, 'browser-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: true, assertions: checks.length, screenshots: screenshots.length, videos, report: path.join(evidence, 'browser-report.json') }, null, 2))
})().catch(error => { fs.writeFileSync(path.join(evidence, 'browser-failure.txt'), String(error.stack || error)); console.error(error); process.exitCode = 1 }).finally(() => { ws?.close(); chrome?.kill(); server?.close(); clearTimeout(deadline) })
