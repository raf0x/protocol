// Local browser regression of the real login component/CSS. Supabase and routing
// are mocked; this never sends email or accesses production. Run with Chrome installed.
const assert = require('node:assert/strict')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const cp = require('node:child_process'), http = require('node:http')
const ts = require('typescript'), WebSocket = require('next/dist/compiled/ws')
const root = process.cwd(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mpp015a-browser-'))
let chrome
const deadline = setTimeout(() => { chrome?.kill(); console.error('Browser QA timed out'); process.exit(1) }, 120000)
const entry = path.join(dir, 'fixture.tsx')
fs.writeFileSync(entry, `import React from ${JSON.stringify(path.join(root, 'node_modules/react'))};
import {createRoot} from ${JSON.stringify(path.join(root, 'node_modules/react-dom/client'))};
import Login from ${JSON.stringify(path.join(root, 'app/auth/login/page.tsx'))};
const base=Date.now();window.qaNow=0;Date.now=()=>base+window.qaNow;
window.qaRouter={replace:path=>window.qaRoutes.push(path),refresh:()=>window.qaRefreshes++};
function Fixture(){const [key,setKey]=React.useState(0);React.useEffect(()=>{window.qaReset=(options={})=>{Object.assign(window,{qaUser:null,qaOwned:[{id:'existing'}],qaOwnershipError:null,qaSendError:null,qaVerifyError:null,qaMissingSession:false,qaCalls:[],qaRoutes:[],qaRefreshes:0},options);history.replaceState(null,'',options.next?'/auth/login?next='+encodeURIComponent(options.next):'/auth/login');setKey(k=>k+1)}} ,[]);return <Login key={key}/>}
Object.assign(window,{qaUser:null,qaOwned:[{id:'existing'}],qaCalls:[],qaRoutes:[],qaRefreshes:0});
createRoot(document.getElementById('root')).render(<Fixture/>);`)
require.extensions['.ts'] = () => {}; require.extensions['.tsx'] = () => {}
const modules = [], ids = new Map()
function bundle(file) {
  file = require.resolve(file)
  if (ids.has(file)) return ids.get(file)
  const id = modules.length; ids.set(file, id); modules.push(null)
  let code = fs.readFileSync(file, 'utf8')
  if (file === path.join(root, 'lib/supabase.ts')) code = `
const pause=()=>new Promise(r=>setTimeout(r,75));exports.createClient=()=>({auth:{
 getUser:async()=>({data:{user:window.qaUser},error:null}),
 signInWithOtp:async args=>{window.qaCalls.push({method:'send',args});await pause();return {error:window.qaSendError}},
 verifyOtp:async args=>{window.qaCalls.push({method:'verify',args});await pause();if(window.qaVerifyError)return {data:{session:null,user:null},error:window.qaVerifyError};const user={id:'qa-owner'};window.qaUser=user;return {data:{session:window.qaMissingSession?null:{access_token:'fixture-only'},user},error:null}}
},from:table=>{const q={select(){return q},eq(k,v){if(table!=='protocols'||k!=='user_id'||v!=='qa-owner')throw Error('Unexpected owner query');return q},limit(){return q},abortSignal(){return q},then(resolve,reject){return Promise.resolve({data:window.qaOwned,error:window.qaOwnershipError}).then(resolve,reject)}};return q}});`
  if (file === require.resolve('next/navigation', { paths: [root] })) code = 'exports.useRouter=()=>window.qaRouter;'
  if (file.endsWith('.module.css')) code = 'module.exports=' + JSON.stringify(Object.fromEntries([...code.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(match => [match[1], match[1]])))
  if (/\.(tsx?|m?js)$/.test(file)) code = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const map = {}
  for (const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const dep = JSON.parse('"' + match[1] + '"')
    map[dep] = bundle(require.resolve(dep, { paths: [path.dirname(file), root] }))
  }
  modules[id] = `function(module,exports){const require=name=>load(${JSON.stringify(map)}[name]);${code}\n}`
  return id
}
const id = bundle(entry)
const js = `const process={env:{NODE_ENV:'production'}};const modules=[${modules.join(',')}],cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports);return module.exports}load(${id});`
const css = fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'app/auth/login/login.module.css'), 'utf8') + '\n*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}'
const html = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>window.errors=[];window.onerror=(...args)=>window.errors.push(args.slice(0,3));</script><script>${js.replaceAll('</script', '<\\/script')}</script></html>`
;(async () => {
  const server = http.createServer((_req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  chrome = cp.spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', '--user-data-dir=' + path.join(dir, 'profile'), 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let ws
  try {
    const portFile = path.join(dir, 'profile', 'DevToolsActivePort')
    let portText = ''
    for (let i = 0; i < 100; i++) { try { portText = fs.readFileSync(portFile, 'utf8'); if (portText.includes('/devtools/')) break } catch {} await new Promise(r => setTimeout(r, 100)) }
    if (!portText) throw Error('Chrome did not start')
    const targets = await (await fetch('http://127.0.0.1:' + portText.split('\n')[0] + '/json')).json()
    ws = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject })
    let seq = 0; const pending = new Map()
    ws.onmessage = event => { const data = JSON.parse(event.data); if (data.id) { const job = pending.get(data.id); pending.delete(data.id); data.error ? job.reject(data.error) : job.resolve(data.result) } }
    const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params })) })
    const run = async code => { const result = await cdp('Runtime.evaluate', { expression: '(async()=>{' + code + '})()', awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value }
    await cdp('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await cdp('Emulation.setFocusEmulationEnabled', { enabled: true })
    await cdp('Page.navigate', { url: 'http://127.0.0.1:' + server.address().port + '/auth/login' })
    await new Promise(r => setTimeout(r, 800))
    await run(`window.checks=[];window.check=(ok,label)=>{if(!ok)throw Error(label);checks.push(label)};window.tick=()=>new Promise(r=>setTimeout(r,130));window.btn=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);window.input=(id,value)=>{const e=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}))};window.send=async(email='new@example.com')=>{input('login-email',email);await tick();btn('Email me a code').click();await tick()};window.verify=async()=>{input('login-code','010203');await tick();btn('Verify code').click();await tick()};window.reset=async options=>{qaReset(options);await tick()};window.advance=async()=>{qaNow+=61000;await new Promise(r=>setTimeout(r,300))};check(!errors.length,'No initial runtime errors');`)
    const screenshots = []
    const screen = async name => { const result = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); const file = path.join(dir, name + '.png'); fs.writeFileSync(file, Buffer.from(result.data, 'base64')); screenshots.push(file) }
    for (const width of [320, 375, 390]) {
      await cdp('Emulation.setDeviceMetricsOverride', { width, height: 844, deviceScaleFactor: 1, mobile: true })
      await run(`await reset();check(document.documentElement.scrollWidth<=innerWidth,'Email no overflow ${width}');check([...document.querySelectorAll('input,button')].every(e=>e.getBoundingClientRect().height>=44),'Email controls 44px ${width}');await send('very.long.address+tag@example.com');check(document.documentElement.scrollWidth<=innerWidth,'Code no overflow ${width}');check([...document.querySelectorAll('input,button')].every(e=>e.getBoundingClientRect().height>=44),'Code controls 44px ${width}');check(document.activeElement.id==='login-code','Code receives keyboard focus ${width}');`)
      await screen('code-' + width)
    }
    await run(`await reset();input('login-email','  New+tag@Example.com  ');await tick();const button=btn('Email me a code');button.click();document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit();check(qaCalls.length===1,'Rapid request taps initiate exactly one OTP call');await tick();check(qaCalls[0].args.email==='New+tag@Example.com','Request trims email safely');check(qaCalls[0].args.options.shouldCreateUser===true,'One unified create-or-sign-in request');check(document.querySelector('h1').textContent==='Check your email','Successful request opens code entry');check(document.querySelector('.description').textContent==='Enter the code sent to New+tag@Example.com.','Neutral request success copy');check(btn('Resend code').disabled,'Resend cooldown starts immediately');check(document.getElementById('login-code').autocomplete==='one-time-code'&&document.getElementById('login-code').inputMode==='numeric','Numeric keyboard and OTP autofill semantics');check(getComputedStyle(document.activeElement).outlineStyle!=='none','Visible code input focus');`)
    const ax = await cdp('Accessibility.getFullAXTree')
    assert.ok(ax.nodes.some(node => node.role?.value === 'textbox' && node.name?.value === '6-digit code'))
    await run(`qaVerifyError={code:'invalid_credentials'};await verify();check(qaRoutes.length===0,'Incorrect code does not navigate');check(document.querySelectorAll('[role=alert]').length===1,'Incorrect code has one inline error');check(document.querySelector('.description').textContent.includes('New+tag@Example.com'),'Failed verification preserves email');qaVerifyError={code:'otp_expired'};await verify();check(document.querySelector('[role=alert]').textContent.includes('Request a new code'),'Expired token explains resend');check(btn('Resend code').disabled,'Expired code does not bypass cooldown');await advance();check(!btn('Resend code').disabled,'Resend enables after provider interval');qaSendError={message:'internal address details'};btn('Resend code').click();await tick();check(document.getElementById('login-code')&&document.querySelector('[role=alert]'),'Failed resend stays on code entry');check(!document.querySelector('[role=alert]').textContent.includes('internal'),'Failed resend hides provider details');qaSendError=null;btn('Resend code').click();await tick();check(document.getElementById('login-code').value==='','Successful resend clears old token input');check(btn('Resend code').disabled,'Successful resend restarts cooldown');check(document.querySelector('[role=status]').textContent.includes('latest email'),'Resend directs user to latest email');input('login-code','012345');await tick();btn('Use a different email').click();await tick();check(document.getElementById('login-email')&&document.activeElement.id==='login-email','Different email returns and focuses field');check(!document.getElementById('login-code'),'Different email removes token field');check(btn('Email me a code').disabled,'Changing email retains cooldown');await advance();await send('different@example.com');check(document.getElementById('login-code').value==='','Different email clears token state');`)
    // A single text insertion exercises the same whole-string path used by paste/autofill.
    await run(`await reset({qaOwned:[]});await send();document.getElementById('login-code').focus();`)
    await cdp('Input.insertText', { text: ' 01 02\t03\n' })
    await run(`await tick();check(document.getElementById('login-code').value==='010203','Whole-code paste normalizes whitespace and keeps leading zeroes');const button=btn('Verify code');button.click();document.querySelector('form').requestSubmit();document.querySelector('form').requestSubmit();check(qaCalls.filter(c=>c.method==='verify').length===1,'Repeated Verify taps call SDK once');await tick();check(qaCalls.find(c=>c.method==='verify').args.token==='010203','Leading zero OTP submitted unchanged');check(qaCalls.find(c=>c.method==='verify').args.type==='email','Email OTP verification type');check(qaRoutes.join()==='/onboarding','New authenticated user reaches onboarding');document.querySelector('form').requestSubmit();await tick();check(qaRoutes.length===1&&qaRefreshes===1&&qaCalls.filter(c=>c.method==='verify').length===1,'Successful verification and navigation execute once');`)
    for (const status of ['planned', 'scheduled', 'active', 'completed']) {
      await run(`await reset({qaOwned:[{id:'p',status:'${status}'}],next:'/timeline?filter=weight'});await send('existing@example.com');check(document.querySelector('h1').textContent==='Check your email','Existing ${status} outward flow matches new');await verify();check(qaRoutes.join()==='/timeline?filter=weight','Existing ${status} preserves safe next');`)
    }
    await run(`await reset({qaOwned:null,qaOwnershipError:{message:'offline'}});await send();await verify();check(qaRoutes.join()==='/protocol','Ownership error fails safely');await reset({qaMissingSession:true});await send();await verify();check(qaRoutes.length===0&&!!document.querySelector('[role=alert]'),'Missing session is not treated as success');await reset({qaSendError:{message:'account already exists'}});await send();check(!!document.getElementById('login-email'),'Failed request remains on email entry');check(!document.body.innerText.includes('account already exists'),'No account existence disclosure');await reset({qaSendError:{status:429}});await send();check(btn('Email me a code').disabled&&document.querySelector('[role=alert]').textContent.includes('timer'),'Request rate limit has retry guidance and cooldown');await advance();check(!btn('Email me a code').disabled,'Rate-limited request can retry after countdown');await reset({qaVerifyError:{status:429}});await send();await verify();check(btn('Verify code').disabled,'Verification rate limit prevents rapid retry');await advance();check(!btn('Verify code').disabled,'Verification retry countdown expires');await reset({next:'//evil.example'});await send('existing@example.com');await verify();check(qaRoutes.join()==='/protocol','Unsafe next never leaves same origin');await reset({qaUser:{id:'qa-owner'},qaOwned:[]});check(qaRoutes.join()==='/onboarding','Existing session shares first-protocol routing');`)
    await run(`await reset();await send();const style=document.createElement('style');style.textContent='.panel p,.panel label,.panel button{font-size:28px}.heading{font-size:52px}';document.head.append(style);check(document.documentElement.scrollWidth<=innerWidth,'Enlarged text does not cause horizontal overflow');`)
    await screen('enlarged-text-390')
    await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 400, deviceScaleFactor: 1, mobile: true })
    await run(`document.querySelector('style:last-of-type')?.remove();document.getElementById('login-code').focus();btn('Verify code').scrollIntoView({block:'center'});check(btn('Verify code').getBoundingClientRect().bottom<=innerHeight,'Verify action reachable with short keyboard viewport');check(errors.length===0,'No runtime errors throughout browser flows');`)
    const checks = await run('return checks')
    const report = { checks, screenshots, accessibility: '6-digit code textbox has an accessible name; focus and error association checked', transport: 'mocked Supabase; local only' }
    fs.writeFileSync(path.join(os.tmpdir(), 'mpp015a-browser.json'), JSON.stringify(report, null, 2))
    console.log(JSON.stringify({ passed: checks.length, screenshots, report: path.join(os.tmpdir(), 'mpp015a-browser.json') }, null, 2))
  } finally { ws?.close(); chrome?.kill(); server.close(); clearTimeout(deadline) }
})().catch(error => { console.error(error); clearTimeout(deadline); process.exitCode = 1 })
