// Targeted persistent-action/F5/F6 checks: actual New Vial component and app theme tokens.
// Synthetic Supabase transport; no account, network or persistence writes.
// Run: npm run validate:browser -- tests/new-vial-accessibility.browser.cjs
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const cp = require('node:child_process'), http = require('node:http'), ts = require('typescript')
const WebSocket = require('next/dist/compiled/ws')
const root = process.cwd(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpp-new-vial-browser-'))
const entry = path.join(dir, 'fixture.tsx')
let chrome, ws, server
const deadline = setTimeout(() => { console.error('New Vial fixture exceeded 90 seconds'); process.exit(1) }, 90000)
fs.writeFileSync(entry, `
import React from ${JSON.stringify(path.join(root, 'node_modules/react'))};
import {createRoot} from ${JSON.stringify(path.join(root, 'node_modules/react-dom/client'))};
import VialInventory from ${JSON.stringify(path.join(root, 'components/dashboard/VialInventory.tsx'))};
import theme from ${JSON.stringify(path.join(root, 'components/app/design-system-v2.module.css'))};
window.qaWrites=[];window.qaEvents=[];window.qaFail=false;window.qaStock=2;window.qaBackground=0;
window.addEventListener('doses_updated',()=>qaEvents.push('doses_updated'));
window.qaDefaults={reconstitutionDate:'2026-09-01',bacWaterMl:2,vialStrength:10,vialUnit:'mg'};
function Fixture({props}){return <div className={'mobile-app-shell today-surface '+theme.theme}><button id="background" onClick={()=>qaBackground++}>Background action</button><VialInventory compoundId="qa-compound" compoundName="Medication" {...props}/></div>}
const fixtureRoot=createRoot(document.getElementById('root'));let revision=0;
window.qaRender=(props,stock)=>{window.qaStock=stock;fixtureRoot.render(<Fixture key={++revision} props={props}/>)};
qaRender(qaDefaults,2);
`)
require.extensions['.ts'] = () => {}; require.extensions['.tsx'] = () => {}
const modules = [], ids = new Map(), styles = []
function bundle(file) {
  file = require.resolve(file)
  if (ids.has(file)) return ids.get(file)
  const id = modules.length; ids.set(file, id); modules.push(null)
  let code = fs.readFileSync(file, 'utf8')
  if (file === path.join(root, 'lib/supabase.ts')) code = `exports.createClient=()=>({from:table=>{
    if(table!=='compounds')throw Error('Unexpected table '+table);let write;
    return {select(){return this},update(value){write=value;return this},eq(key,id){if(key!=='id'||id!=='qa-compound')throw Error('Unexpected owner/compound filter');return this},single:async()=>({data:{vials_in_stock:qaStock}}),then(resolve,reject){return Promise.resolve().then(()=>{qaWrites.push(write);if(qaFail)return {error:{message:'Mock rejected update'}};qaStock=write.vials_in_stock;return {error:null}}).then(resolve,reject)}}
  }});`
  if (file.endsWith('.module.css')) {
    const names = {}, globals = []
    let css = code.replace(/:global\(([^)]+)\)/g, (_, value) => 'GLOBALTOKEN' + (globals.push(value) - 1))
    css = css.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => '.' + (names[name] = 'm' + id + '_' + name))
    styles.push(css.replace(/GLOBALTOKEN(\d+)/g, (_, i) => globals[i])); code = 'module.exports=' + JSON.stringify(names)
  }
  if (/\.(tsx?|m?js)$/.test(file)) code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const map = {}
  for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const dependency = JSON.parse('"' + match[1] + '"')
    if (require('node:module').isBuiltin(dependency)) throw Error('Unexpected browser builtin: ' + dependency)
    map[dependency] = bundle(require.resolve(dependency, { paths: [path.dirname(file), root] }))
  }
  modules[id] = `function(module,exports){const require=name=>load(${JSON.stringify(map)}[name]);${code}\n}`
  return id
}
const id = bundle(entry)
const js = `const process={env:{NODE_ENV:'production'}};const modules=[${modules.join(',')}],cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports);return module.exports}load(${id});`
const css = ['app/globals.css', 'app/mobile-app.css'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n') + '\n' + styles.join('\n')
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody{margin:0;font-family:Inter,Arial,sans-serif}</style><div id="root"></div><script>window.errors=[];window.onerror=(...args)=>errors.push(args.slice(0,3));window.onunhandledrejection=e=>errors.push(String(e.reason));window.fetch=()=>{throw Error('Real requests are forbidden')};</script><script>${js.replaceAll('</script', '<\\/script')}</script></html>`
;(async () => {
  server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  chrome = cp.spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(dir, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let port = ''
  for (let i = 0; i < 100; i++) {
    try { port = fs.readFileSync(path.join(dir, 'profile/DevToolsActivePort'), 'utf8'); if (port.includes('/devtools/')) break } catch {}
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  if (!port) throw Error('Chrome did not start')
  const targets = await (await fetch('http://127.0.0.1:' + port.split('\n')[0] + '/json', { signal: AbortSignal.timeout(10000) })).json()
  ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
  let seq = 0; const pending = new Map()
  ws.onmessage = event => { const message = JSON.parse(event.data); if (!message.id) return; const job = pending.get(message.id); if (!job) return; clearTimeout(job.timer); pending.delete(message.id); message.error ? job.reject(message.error) : job.resolve(message.result) }
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout: ' + method)) }, 10000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })) })
  const run = async code => { const result = await cdp('Runtime.evaluate', { expression: '(async()=>{' + code + '})()', awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
  const press = async (key, code, value, modifiers = 0) => { for (const type of ['keyDown', 'keyUp']) await cdp('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: value, modifiers, ...(type === 'keyDown' && key === 'Enter' ? { text: '\r' } : {}) }) }
  const viewport = width => cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: width < 600 })
  const screenshots = []
  const screen = async name => { const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(dir, name + '.png'); fs.writeFileSync(file, Buffer.from(shot.data, 'base64')); screenshots.push(file) }
  await viewport(1440)
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
  await cdp('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port })
  await new Promise(resolve => setTimeout(resolve, 500))
  const startupErrors = await run('return errors')
  if (startupErrors.length) throw Error('New Vial fixture startup: ' + JSON.stringify(startupErrors))
  await run(`window.checks=[];window.contrast=[];window.check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};window.tick=()=>new Promise(r=>setTimeout(r,80));window.dialog=()=>document.querySelector('dialog');window.trigger=()=>document.querySelector('.vial-new-button');window.button=label=>[...document.querySelectorAll('button')].find(e=>e.textContent===label);window.setInput=(input,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}))};window.luminance=color=>{const channels=color.match(/[0-9.]+/g).slice(0,3).map(v=>Number(v)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722};window.readable=(element,label,theme)=>{const fg=getComputedStyle(element).color,bg=getComputedStyle(dialog()).backgroundColor,a=luminance(fg),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);contrast.push({theme,label,ratio,foreground:fg,background:bg});check(ratio>=4.5,theme+' '+label+' contrast '+ratio.toFixed(2))};check(trigger()!==null,'New Vial trigger loads');`)
  for (const theme of ['light', 'dark']) {
    await run(`document.documentElement.dataset.theme='${theme}';trigger().focus()`)
    await press('Enter', 'Enter', 13)
    await run(`await tick();const d=dialog();check(d!==null&&d.open,'${theme} Enter opens');check(d.matches(':modal'),'${theme} native modal blocks background');check(d.getAttribute('aria-modal')==='true','${theme} modal semantics');const heading=document.getElementById(d.getAttribute('aria-labelledby'));check(heading===d.querySelector('h3')&&heading.textContent==='Starting a new Medication vial?','${theme} dialog named by visible heading');check(document.activeElement===d.querySelector('input'),'${theme} focus enters first field');for(const input of d.querySelectorAll('input'))check([...d.querySelectorAll('label')].some(label=>label.htmlFor===input.id),'${theme} focused field has a label');readable(heading,'title','${theme}');readable(d.querySelector('p'),'helper','${theme}');for(const label of d.querySelectorAll('label'))readable(label,label.textContent,'${theme}');check(Math.abs(d.getBoundingClientRect().width-380)<1,'${theme} desktop width preserved');check(getComputedStyle(d).padding==='24px','${theme} spacing preserved');document.getElementById('background').focus();check(d.contains(document.activeElement),'${theme} background cannot take focus');d.querySelector('input').focus();`)
    const ax = await cdp('Accessibility.getFullAXTree')
    const named = ax.nodes.find(node => node.role?.value === 'dialog' && !node.ignored)
    if (named?.name?.value !== 'Starting a new Medication vial?') throw Error(theme + ' native accessibility tree name')
    await run(`check(true,'${theme} native accessibility tree exposes correct name')`)
    await press('Tab', 'Tab', 9, 8)
    await run(`check(document.activeElement===button('Log New Vial'),'${theme} Shift+Tab wraps to last enabled control')`)
    await press('Tab', 'Tab', 9)
    await run(`check(document.activeElement===dialog().querySelector('input'),'${theme} Tab wraps to first field')`)
    await press('Escape', 'Escape', 27)
    await run(`await tick();check(!dialog(),'${theme} Escape closes');check(document.activeElement===trigger(),'${theme} Escape restores trigger focus')`)
    await press(' ', 'Space', 32)
    await run(`await tick();check(dialog()?.open,'${theme} Space opens');check(document.activeElement===dialog().querySelector('input'),'${theme} Space entry focus');button('Cancel').click();await tick();check(!dialog(),'${theme} Cancel closes');check(document.activeElement===trigger(),'${theme} Cancel restores trigger focus');trigger().click();await tick();check(document.activeElement===dialog().querySelector('input'),'${theme} mouse entry focus');window.expectedValues=['10.0','2026-10-03','2.0'];[...dialog().querySelectorAll('input')].forEach((input,i)=>setInput(input,expectedValues[i]));await tick();window.stockBefore=qaStock;window.eventsBefore=qaEvents.length;qaFail=true;button('Log New Vial').focus()`)
    await press('Enter', 'Enter', 13)
    await run(`await tick();check(dialog()?.open,'${theme} failed save keeps dialog open');check([...dialog().querySelectorAll('input')].every((input,i)=>input.value===expectedValues[i]),'${theme} failed save preserves values');const error=dialog().querySelector('[role="alert"]');check(error?.textContent.includes('wasn’t saved'),'${theme} failure error visible');readable(error,'error','${theme}');check(document.activeElement===error,'${theme} failed save focuses the error inside dialog');check(!button('Log New Vial').disabled,'${theme} failed save releases saving');check(qaStock===stockBefore,'${theme} failure leaves stock unchanged');check(qaEvents.length===eventsBefore,'${theme} failure dispatches no event');window.failedPayload=qaWrites.at(-1);`)
    await screen('new-vial-' + theme + '-error-1440')
    await run(`qaFail=false;button('Log New Vial').focus()`)
    await press('Enter', 'Enter', 13)
    await run(`await tick();check(!dialog(),'${theme} successful retry closes');check(document.activeElement===trigger(),'${theme} success restores trigger focus');check(JSON.stringify(qaWrites.at(-1))===JSON.stringify(failedPayload),'${theme} retry uses preserved payload');check(qaEvents.length===eventsBefore+1,'${theme} success dispatches one existing event');check(qaStock===Math.max(0,stockBefore-1),'${theme} success decrements stock once')`)
  }
  await viewport(390)
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: true })
  const tap = async selector => {
    const point = await run(`const element=document.querySelector(${JSON.stringify(selector)});element.scrollIntoView({block:'center'});const box=element.getBoundingClientRect();return {x:(box.left+box.right)/2,y:(box.top+box.bottom)/2}`)
    await cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 1, radiusY: 1 }] })
    await cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await tap('.vial-new-button')
  await run(`await tick();check(dialog()?.open,'390 touch opens');check(document.activeElement===dialog().querySelector('input'),'390 touch enters first field');check(Math.abs(dialog().getBoundingClientRect().width-342)<1,'390 width and outer spacing preserved');check(dialog().getBoundingClientRect().left>=24&&dialog().getBoundingClientRect().right<=innerWidth-24,'390 dialog stays in viewport');dialog().querySelector('button').id='cancel-touch';`)
  await screen('new-vial-dark-390')
  await tap('#cancel-touch')
  await run(`await tick();check(!dialog(),'390 touch Cancel closes');check(document.activeElement===trigger(),'390 touch Cancel restores focus');check(errors.length===0,'No New Vial runtime errors')`)
  await viewport(1440)
  await cdp('Emulation.setTouchEmulationEnabled', { enabled: false })
  for (const theme of ['light', 'dark']) for (const scenario of [
    { name: 'missing date', props: { reconstitutionDate: null }, stock: 2 },
    { name: 'invalid date', props: { reconstitutionDate: 'invalid' }, stock: 2 },
    { name: 'missing BAC water', props: { bacWaterMl: null }, stock: 2, lifecycle: true },
    { name: 'missing strength', props: { vialStrength: null }, stock: 2, lifecycle: true },
    { name: 'missing strength and water', props: { vialStrength: null, bacWaterMl: null }, stock: 2, lifecycle: true },
    { name: 'zero stock', props: {}, stock: 0, lifecycle: true },
    { name: 'unknown stock', props: {}, stock: null, lifecycle: true },
    { name: 'missing metadata and zero stock', props: { reconstitutionDate: null, vialStrength: null, bacWaterMl: null }, stock: 0 },
    { name: 'missing metadata and unknown stock', props: { reconstitutionDate: null, vialStrength: null, bacWaterMl: null }, stock: null },
  ]) {
    const label = theme + ' ' + scenario.name
    await run(`document.documentElement.dataset.theme=${JSON.stringify(theme)};qaRender({...qaDefaults,...${JSON.stringify(scenario.props)}},${JSON.stringify(scenario.stock)});await tick();check(trigger()!==null,${JSON.stringify(label + ' trigger stays available')});check(document.querySelector('.vial-lifecycle-title')?.textContent==='VIAL LIFECYCLE',${JSON.stringify(label + ' lifecycle label stays available')});const status=document.querySelector('.vial-lifecycle-status'),track=document.querySelector('.vial-lifecycle-track');check(Boolean(status)===${Boolean(scenario.lifecycle)}&&Boolean(track)===${Boolean(scenario.lifecycle)},${JSON.stringify(label + ' lifecycle details depend only on calculable date')});${scenario.lifecycle ? `check(new RegExp('^Day [0-9]+/28').test(status.textContent)&&!status.textContent.includes('NaN'),${JSON.stringify(label + ' real day status preserved')});check(Number.isFinite(parseFloat(track.firstElementChild.style.width)),${JSON.stringify(label + ' real progress preserved')});` : `check(document.querySelector('.vial-lifecycle-toolbar').children.length===2,${JSON.stringify(label + ' compact row contains label and action')});check(getComputedStyle(document.querySelector('.vial-lifecycle-toolbar')).marginBottom==='0px',${JSON.stringify(label + ' compact spacing')});check(!/Day |d left|EXPIRED|NaN/.test(document.querySelector('.vial-lifecycle').textContent),${JSON.stringify(label + ' no fabricated lifecycle details')});`}window.writesBefore=qaWrites.length;window.eventsBefore=qaEvents.length;trigger().focus();`)
    await press('Enter', 'Enter', 13)
    await run(`await tick();const d=dialog();check(d?.open&&d.matches(':modal'),${JSON.stringify(label + ' opens existing native modal')});check(d.getAttribute('aria-modal')==='true',${JSON.stringify(label + ' modal semantics preserved')});const heading=document.getElementById(d.getAttribute('aria-labelledby'));check(heading===d.querySelector('h3')&&heading.textContent==='Starting a new Medication vial?',${JSON.stringify(label + ' dialog name preserved')});check(document.activeElement===d.querySelector('input'),${JSON.stringify(label + ' focus enters first field')});for(const input of d.querySelectorAll('input'))check([...d.querySelectorAll('label')].some(field=>field.htmlFor===input.id),${JSON.stringify(label + ' field labels preserved')});readable(heading,${JSON.stringify(scenario.name + ' title')},${JSON.stringify(theme)});readable(d.querySelector('p'),${JSON.stringify(scenario.name + ' helper')},${JSON.stringify(theme)});for(const field of d.querySelectorAll('label'))readable(field,${JSON.stringify(scenario.name + ' ')}+field.textContent,${JSON.stringify(theme)});${Object.hasOwn(scenario.props, 'vialStrength') ? `check(d.querySelector('input').value==='',${JSON.stringify(label + ' strength remains blank')});` : ''}${Object.hasOwn(scenario.props, 'bacWaterMl') ? `check(d.querySelector('input:last-of-type').value==='',${JSON.stringify(label + ' water remains blank')});` : ''}document.getElementById('background').focus();check(d.contains(document.activeElement),${JSON.stringify(label + ' background cannot take focus')});d.querySelector('input').focus();`)
    await press('Tab', 'Tab', 9, 8)
    await run(`check(document.activeElement===button('Log New Vial'),${JSON.stringify(label + ' Shift+Tab wraps to last control')})`)
    await press('Tab', 'Tab', 9)
    await run(`check(document.activeElement===dialog().querySelector('input'),${JSON.stringify(label + ' Tab wraps to first field')})`)
    await press('Escape', 'Escape', 27)
    await run(`await tick();check(!dialog(),${JSON.stringify(label + ' Escape closes')});check(document.activeElement===trigger(),${JSON.stringify(label + ' Escape restores trigger focus')});check(qaWrites.length===writesBefore&&qaEvents.length===eventsBefore,${JSON.stringify(label + ' opening and dismissing does not save')});check(errors.length===0,${JSON.stringify(label + ' no runtime errors')})`)
    if (scenario.name === 'missing metadata and unknown stock') {
      await screen('new-vial-' + theme + '-missing-metadata-header-1440')
      await viewport(390)
      await run(`const box=trigger().getBoundingClientRect();check(box.left>=0&&box.right<=innerWidth,${JSON.stringify(label + ' mobile trigger stays in viewport')})`)
      await screen('new-vial-' + theme + '-missing-metadata-header-390')
      await viewport(1440)
    }
  }
  const report = { scope: 'Persistent New Vial action and F5/F6, including frozen F3 preservation', passed: (await run('return checks')).length, checks: await run('return checks'), contrast: await run('return contrast'), screenshots, errors: await run('return errors'), fixture: 'Actual VialInventory with app/theme CSS and synthetic compounds transport; no real backend writes.' }
  const reportPath = path.join(dir, 'browser-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ passed: report.passed, contrast: report.contrast, screenshots, report: reportPath }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 }).finally(() => { ws?.close(); chrome?.kill(); server?.close(); clearTimeout(deadline) })
