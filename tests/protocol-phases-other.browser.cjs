// Actual ProtocolDetail and ManagePage with production CSS, synthetic data, no live backend.
// Run: npm run validate:browser -- tests/protocol-phases-other.browser.cjs
// Optional: RELEASE3B_EVIDENCE_DIR overrides the permanent evidence destination.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const cp = require('node:child_process'), http = require('node:http')
const root = process.cwd(), canonical = path.resolve(root, '../MyPepProtocol-Dev')
const toolRequire = require('node:module').createRequire(path.join(fs.existsSync(path.join(root, 'node_modules/typescript')) ? root : canonical, 'package.json'))
const WebSocket = toolRequire('next/dist/compiled/ws')
const sha256 = data => require('node:crypto').createHash('sha256').update(data).digest('hex')
const evidence = process.env.RELEASE3B_EVIDENCE_DIR || path.resolve(root, '../Release-3B-Visual-Review')
fs.mkdirSync(evidence, { recursive: true })
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'release3b-browser-runtime-'))
const sourceHashes = { 'tests/protocol-phases-other.browser.cjs': sha256(fs.readFileSync(__filename)) }, screenshots = [], videos = [], checks = [], matrix = [], semanticBaselines = {}
const baseline = 'fb22d5e12b0fb6c0e8b11a562691a71f636f6408'
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let chrome, ws, server
const deadline = setTimeout(() => { console.error('Release 3B browser deadline exceeded'); process.exit(1) }, 300000)
const entry = path.join(runtime, 'fixture.tsx')
fs.writeFileSync(entry, `
import React from 'react'; import {createRoot} from 'react-dom/client';
import ProtocolDetail from ${JSON.stringify(path.join(root, 'components/protocols/ProtocolDetail.tsx'))}; import ManagePage from ${JSON.stringify(path.join(root, 'app/protocol/manage/page.tsx'))};
const NativeDate=Date; window.Date=class extends NativeDate { constructor(...args){super(...(args.length?args:['2026-11-04T12:00:00']))} static now(){return new NativeDate('2026-11-04T12:00:00').getTime()} };
window.qaNavigation=new URLSearchParams(location.search).get('qaNavigation');
window.qaWrites=[];window.qaRequests=[];window.qaActions=[];window.qaMode='multiple';window.qaSurface=new URLSearchParams(location.search).get('surface')||'detail';
window.qaProtocol=(mode='multiple')=>({id:'synthetic-protocol',name:'Synthetic review protocol',status:mode==='completed'?'completed':mode==='planned'?'planned':'active',start_date:mode==='missing-dates'||mode==='planned'?null:mode==='scheduled'?'2026-12-01':'2026-10-01',completed_date:mode==='completed'?'2026-10-20':null,
compounds:mode==='empty'?[]:Array.from({length:mode==='multiple'?2:1},(_,i)=>{const p={id:'phase-'+i+'-b',name:'Ongoing phase',start_week:3,end_week:null,dose:0.125,dose_unit:i?'IU':'mg',dose_semantics_version:1,frequency:'daily',route:'SubQ',injection_volume_ml:.03125,syringe_units:1.25,syringe_scale:i?40:100,days_of_week:[0,1,2,3,4,5,6],time_of_day:'Morning'};
if(mode==='review')p.dosing_entry={version:2,mode:'syringe',review_status:'unconfirmed',dose:'',dose_unit:'',syringe_markings:'1.25',syringe_scale:'40',injection_volume:'',vial_strength:'',vial_unit:'',bac_water_ml:'',preparation:'ready',concentration_value:'',concentration_unit:'',vial_label:''};
if(mode==='unknown')Object.assign(p,{start_week:null,end_week:null,dose:null,dose_unit:null,route:null,injection_volume_ml:null,syringe_units:null,syringe_scale:null});
if(mode==='expired')p.end_week=4;
return {id:'compound-'+i,name:i?'Synthetic compound B':'Synthetic compound A',vial_strength:5,vial_unit:'mg',bac_water_ml:2,vials_in_stock:2,reconstitution_date:mode==='missing-dates'?null:'2026-10-01',notes:'Synthetic fixture; no real treatment.',phases:mode==='no-phases'?[]:[{...p,id:'phase-'+i+'-a',name:'Historical phase',start_week:1,end_week:2,dose:.0625,dose_unit:'mcg'},p]};})});
window.qaRouter={push:url=>qaActions.push(['navigate',url]),replace:url=>qaActions.push(['navigate',url]),refresh:()=>{}};
const action=name=>(...args)=>qaActions.push([name,...args]);
function Fixture(){const[state,setState]=React.useState({mode:'multiple',surface:qaSurface,version:0});React.useEffect(()=>{window.qaReset=(mode='multiple',surface=qaSurface)=>{qaMode=mode;qaSurface=surface;qaRequests=[];qaWrites=[];qaActions=[];if(surface==='editor')history.replaceState(null,'','?protocol=synthetic-protocol');setState(s=>({mode,surface,version:s.version+1}))}},[]);const protocol=React.useMemo(()=>qaProtocol(state.mode),[state.mode,state.version]);return state.surface==='editor'?<ManagePage key={state.version}/>:<main className='protocols-page'><ProtocolDetail key={state.version} protocol={protocol} today='2026-11-04' onBack={action('back')} onEdit={action('edit')} onComplete={action('complete')} onPause={action('pause')} onResume={action('resume')} onReactivate={action('reactivate')} onDelete={action('delete')} onReload={action('reload')}/></main>}
sessionStorage.setItem('mpp:first-protocol:synthetic-owner','1');createRoot(document.getElementById('root')).render(<Fixture/>);
`)

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
    if (before && ['components/protocols/PhaseCard.tsx','app/protocol/manage/page.tsx'].includes(relative)) code = cp.execFileSync('git', ['show', baseline + ':' + relative], { cwd: root, encoding: 'utf8', windowsHide: true })
    if (!relative.startsWith('..') && !relative.startsWith('node_modules')) sourceHashes[(before ? 'before:' : 'after:') + relative] = sha256(code)
    if (file === path.join(root, 'lib/supabase.ts')) code = String.raw`
      exports.createClient=()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}},error:null})},from:table=>{
        const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},insert(v){qaWrites.push({table,v});throw Error('Unexpected write')},update(v){qaWrites.push({table,v});throw Error('Unexpected write')},delete(){qaWrites.push({table});throw Error('Unexpected write')},then(resolve,reject){qaRequests.push(table);return Promise.resolve({data:table==='protocols'?[qaProtocol(qaMode)]:[],error:null}).then(resolve,reject)}};return q}});
    `

    if(file===toolRequire.resolve('next/navigation'))code="exports.useRouter=()=>qaRouter;exports.usePathname=()=>'/protocol/manage';exports.useSearchParams=()=>new URLSearchParams(location.search);";
    if(file===toolRequire.resolve('next/link'))code="const React=require('react');exports.__esModule=true;exports.default=({prefetch,onClick,...props})=>React.createElement('a',{...props,onClick:e=>{e.preventDefault();qaActions.push(['navigate',props.href]);onClick?.(e)}});";
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
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Release 3B synthetic Protocol Detail — ' + (before ? 'before' : 'after') + '</title><style>' + css + '\n*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:var(--app-bg);color:var(--app-text)}.protocols-page{padding:18px 16px 32px;max-width:760px;margin:auto}</style></head><body><div id="root"></div><script>window.errors=[];window.onerror=(...args)=>errors.push(args.slice(0,3));window.onunhandledrejection=e=>errors.push(String(e.reason));window.fetch=()=>{throw Error("Unexpected real network request")};window.XMLHttpRequest=function(){throw Error("Unexpected real network request")};</script><script>' + script.replaceAll('</script', '<\\/script') + '</script></body></html>'
}

function installChecks() {
  window.qaChecks=[];
  window.check=(ok,label)=>{if(!ok)throw Error(label);qaChecks.push(label)};
  window.tick=ms=>new Promise(resolve=>setTimeout(resolve,ms??60));
  window.waitFor=async predicate=>{for(let i=0;i<100;i++){if(predicate())return;await tick(20)}throw Error('Fixture wait timeout '+JSON.stringify(errors)+' '+document.body.innerText.slice(0,500))};
  window.openDetails=async()=>{const more=document.querySelector('.protocol-more-details');if(more)more.open=true;document.querySelectorAll('.protocol-phase-history').forEach(e=>e.open=true);await tick()};
  window.openEditor=async(kind='other')=>{await waitFor(()=>document.querySelector('.protocol-editor'));const more=document.querySelector('.dosing-more-options');more.open=true;await tick();const button=document.querySelector('[aria-controls="dosing-panel-0-'+kind+'"]');if(button.getAttribute('aria-expanded')!=='true')button.click();await tick()};
  window.art=kind=>document.querySelector('[data-protocol-setup-artwork="'+kind+'"]');
  window.semantic=()=>{const actual=document.querySelector(qaSurface==='editor'?'.protocol-editor':'.protocol-detail');const clone=actual.cloneNode(true);clone.querySelectorAll('[data-protocol-setup-artwork],[data-protocol-artwork]').forEach(e=>e.remove());const text=e=>e?.textContent.replace(/\s+/g,' ').trim()||'';return {text:text(clone),controls:[...actual.querySelectorAll('button,summary,input,select,a')].filter(e=>!e.closest('[data-protocol-artwork]')).map(e=>({tag:e.tagName,text:text(e),label:e.getAttribute('aria-label'),value:e.value??null,disabled:e.disabled??false,expanded:e.getAttribute('aria-expanded'),options:e.tagName==='SELECT'?[...e.options].map(o=>[o.value,o.text,o.disabled]):null}))}};
  window.checkEditorHitTargets=async label=>{
    for(const selector of ['[aria-controls="dosing-panel-0-phases"]','[aria-controls="dosing-panel-0-other"]','#dosing-panel-0-other [aria-label="Compound name"]','#dosing-panel-0-other [aria-label="Vial label"]','#dosing-panel-0-other [aria-label="Protocol start date"]']){
      const target=document.querySelector(selector);if(!target||!target.getClientRects().length)continue;
      target.scrollIntoView({block:'center'});await tick(20);const r=target.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      check(target===hit||target.contains(hit),label+' pointer can reach '+selector+' after scroll');
    }
  };
  window.layout=label=>{
    check(document.documentElement.scrollWidth<=innerWidth,label+' no horizontal overflow');
    const visible=[...document.querySelectorAll('[data-protocol-setup-artwork]')].filter(e=>e.getClientRects().length);
    check(visible.length>0,label+' production custom SVG is visible');
    for(const e of visible){const svg=e.querySelector('svg'),r=e.getBoundingClientRect();check(e.getAttribute('aria-hidden')==='true'||svg?.getAttribute('aria-hidden')==='true',label+' artwork decorative');check(svg?.getAttribute('focusable')==='false',label+' SVG not focusable');check(r.width>50&&r.left>=0&&r.right<=innerWidth+1,label+' artwork contained');check(svg.querySelectorAll('path,circle,rect,ellipse').length>=12,label+' detailed original geometry');check(!svg.textContent.trim(),label+' artwork has no invented phase numbers');}
    const ids=[...document.querySelectorAll('svg [id]')].map(e=>e.id);check(new Set(ids).size===ids.length,label+' all SVG IDs unique');
    for(const svg of document.querySelectorAll('[data-protocol-setup-artwork] svg'))for(const e of svg.querySelectorAll('*'))for(const attr of e.attributes)for(const ref of attr.value.matchAll(/url\(#([^)]+)\)/g))check(Boolean(svg.querySelector('[id="'+ref[1]+'"]')),label+' local SVG reference');
    const root=document.querySelector(qaSurface==='editor'?'.protocol-editor':'.protocol-phase');
    for(const e of root.querySelectorAll('button,input,select,summary')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect();check(r.left>=0&&r.right<=innerWidth+1,label+' existing control within viewport width '+(e.getAttribute('aria-label')||e.textContent.trim().slice(0,30)));}
    for(const button of document.querySelectorAll('.dosing-option-card')){if(!button.querySelector('[data-protocol-setup-artwork]')||!button.getClientRects().length)continue;const r=button.getBoundingClientRect();check(r.width>=44&&r.height>=44,label+' artwork chooser retains 44px touch target');}check(qaWrites.length===0,label+' no backend writes');check(errors.length===0,label+' no runtime errors');
  };
}

if(process.argv.includes('--build-fixtures')){
  const pages={'/before':htmlFor(true),'/after':htmlFor(false)};
  for(const [route,html]of Object.entries(pages))fs.writeFileSync(path.join(evidence,route.slice(1)+'-fixture.html'),html);
  fs.writeFileSync(path.join(evidence,'fixture-source-hashes.json'),JSON.stringify({baseline,sourceHashes,entryHash:sha256(fs.readFileSync(entry)),artifacts:Object.fromEntries(Object.entries(pages).map(([k,v])=>[k,sha256(v)]))},null,2));
  const labEntry="import React from 'react';import{createRoot}from'react-dom/client';import{VisualFeatureCard}from "+JSON.stringify(path.join(canonical,'components/visual-system/VisualFeatureCard.tsx'))+";window.qaReset=()=>{};window.qaNavigation=new URLSearchParams(location.search).get('qaNavigation');createRoot(document.getElementById('root')).render(<main style={{padding:24,maxWidth:760,margin:'auto',display:'grid',gap:20}}>{[{id:'phases',title:'Phases',state:'Flexible phases',descriptor:'Adjust over time'},{id:'other',title:'Other',state:'Additional details',descriptor:'Names, dates, and setup'}].map(feature=><VisualFeatureCard key={feature.id} feature={feature} onSelect={()=>{}}/>)}</main>);";
  fs.writeFileSync(entry,labEntry);fs.writeFileSync(path.join(evidence,'lab-reference.html'),htmlFor(false));
  clearTimeout(deadline);process.exit(0);
}

;(async()=>{
  cp.execFileSync(process.execPath,['--max-old-space-size=384',__filename,'--build-fixtures'],{cwd:root,windowsHide:true,stdio:'inherit',timeout:90000});
  const fixture=JSON.parse(fs.readFileSync(path.join(evidence,'fixture-source-hashes.json'),'utf8'));
  if(fixture.baseline!==baseline||fixture.entryHash!==sha256(fs.readFileSync(entry)))throw Error('Fixture identity mismatch');
  for(const[name,expected]of Object.entries(fixture.sourceHashes)){
    const rel=name.replace(/^(before|after):/,'');
    const code=name.startsWith('before:')&&['components/protocols/PhaseCard.tsx','app/protocol/manage/page.tsx'].includes(rel)?cp.execFileSync('git',['show',baseline+':'+rel],{cwd:root,windowsHide:true}):fs.readFileSync(path.join(root,rel));
    if(sha256(code)!==expected)throw Error('Source changed after fixture generation: '+name);
  }
  const pages=Object.fromEntries(['before','after','lab-reference'].map(name=>['/'+name,fs.readFileSync(path.join(evidence,name+'-fixture.html').replace('lab-reference-fixture','lab-reference'),'utf8')]));
  for(const[route,expected]of Object.entries(fixture.artifacts))if(sha256(pages[route])!==expected)throw Error('Fixture hash mismatch '+route);
  server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(pages[req.url?.split('?')[0]]||'')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  chrome=cp.spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+path.join(runtime,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',data=>fs.appendFileSync(path.join(evidence,'chrome-stderr.log'),data));let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(runtime,'profile/DevToolsActivePort'),'utf8');if(port.includes('/devtools/'))break}catch{}await sleep(100)}if(!port)throw Error('Chrome did not start');
  const targets=await(await fetch('http://127.0.0.1:'+port.split('\n')[0]+'/json')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
  let seq=0,recording=null;const pending=new Map();
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const job=pending.get(message.id);if(!job)return;clearTimeout(job.timer);pending.delete(message.id);message.error?job.reject(message.error):job.resolve(message.result)}if(message.method==='Page.screencastFrame'){if(recording)recording.push({data:message.params.data,timestamp:message.params.metadata.timestamp});void cdp('Page.screencastFrameAck',{sessionId:message.params.sessionId})}};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
  const run=async code=>{const result=await cdp('Runtime.evaluate',{expression:'(async()=>{'+code+'})()',awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value};
  const harvest=async()=>{checks.push(...await run('return qaChecks'));await run('qaChecks=[]')};
  const viewport=(width,height=844)=>cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<600});let navigation=0;
  const navigate=async(stage,theme,surface='detail')=>{console.log('Browser '+stage+' '+theme+' '+surface);const nav=String(++navigation);await cdp('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/'+stage+'?qaNavigation='+nav+'&surface='+surface+(surface==='editor'?'&protocol=synthetic-protocol':'')});let ready=false;for(let i=0;i<200;i++){try{const s=await cdp('Runtime.evaluate',{expression:'window.qaNavigation==='+JSON.stringify(nav)+'&&document.readyState==="complete"&&typeof window.qaReset==="function"',returnByValue:true});if(s.result?.value){ready=true;break}}catch{}await sleep(40)}if(!ready)throw Error('Document not ready');await run('document.documentElement.dataset.theme='+JSON.stringify(theme)+';('+installChecks.toString()+')();');if(stage==='lab-reference')return;if(stage==='after')await run('await tick(1200)');await run(surface==='editor'?'await openEditor()':'await openDetails()');if(stage==='after')await run("art('phases').scrollIntoView({block:'center'});await tick(80);if(!matchMedia('(prefers-reduced-motion: reduce)').matches)check([...document.querySelectorAll('[data-protocol-setup-artwork]')].some(e=>e.getClientRects().length&&e.getAttribute('data-playing')==='true'&&e.getAnimations({subtree:true}).some(a=>a.playState==='running')),'Disclosure first opened after 1.2s closed still plays entrance motion');")};
  const screen=async(name,full=false)=>{const metrics=full?await cdp('Page.getLayoutMetrics'):null;const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,...(full?{clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}}:{})});const file=path.join(evidence,name+'.png');fs.writeFileSync(file,Buffer.from(shot.data,'base64'));screenshots.push(file)};
  const key=async(key,code,n,text)=>{for(const type of['keyDown','keyUp'])await cdp('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:n,...(type==='keyDown'&&text?{text}:{})})};
  await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
  const modes=['multiple','completed','missing-dates','unknown','review','no-phases','planned','scheduled','expired','empty'];
  for(const theme of['dark','light'])for(const surface of['detail','editor']){
    await viewport(390);await navigate('before',theme,surface);await run('scrollTo(0,0)');await screen('before-'+surface+'-390-'+theme,true);
    if(theme==='dark')for(const mode of modes.filter(m=>surface==='detail'||!['empty','unknown'].includes(m))){await run('qaReset('+JSON.stringify(mode)+','+JSON.stringify(surface)+');await tick();'+(surface==='detail'?'await openDetails()':'await openEditor()'));semanticBaselines[surface+':'+mode]=await run('return semantic()');}
  }
  for(const theme of['dark','light'])for(const width of[320,390])for(const surface of['detail','editor']){
    await viewport(width);await navigate('after',theme,surface);await run('await tick(1050);layout('+JSON.stringify(theme+' '+width+' '+surface)+')');
    const after=await run('return semantic()');if(JSON.stringify(after)!==JSON.stringify(semanticBaselines[surface+':multiple'])){fs.writeFileSync(path.join(evidence,'semantic-parity-failure.json'),JSON.stringify({surface,before:semanticBaselines[surface+':multiple'],after},null,2));throw Error('Semantic mismatch '+surface)}
    await run('check(true,"Exact baseline data, units, warnings and controls preserved");');if(surface==='editor')await run('await checkEditorHitTargets('+JSON.stringify(theme+' '+width+' editor')+')');
    await run('scrollTo(0,0)');await screen('after-'+surface+'-'+width+'-'+theme,true);
    if(width===390){await run(surface==='editor'?"document.querySelector('.dosing-option-grid').scrollIntoView({block:'center'})":"document.querySelector('.protocol-phase').scrollIntoView({block:'center'})");await screen('after-'+surface+'-artwork-390-'+theme)}matrix.push({surface,theme,width});await harvest();
  }
  await viewport(390);
  for(const surface of['detail','editor']){
    await navigate('after','dark',surface);
    for(const mode of modes.filter(m=>surface==='detail'||!['empty','unknown'].includes(m))){console.log('Semantic case '+surface+' '+mode);await run('qaReset('+JSON.stringify(mode)+','+JSON.stringify(surface)+');await tick();'+(surface==='detail'?'await openDetails()':'await openEditor()'));const actual=await run('return semantic()');if(JSON.stringify(actual)!==JSON.stringify(semanticBaselines[surface+':'+mode])){fs.writeFileSync(path.join(evidence,'semantic-parity-failure.json'),JSON.stringify({surface,mode,before:semanticBaselines[surface+':'+mode],actual},null,2));throw Error('Semantic parity '+surface+' '+mode)}await run('check(true,'+JSON.stringify(surface+' '+mode+' exact baseline medical facts and controls preserved')+');check(qaWrites.length===0,"No write on presentation");');if(mode!=='empty')await run('layout('+JSON.stringify(surface+' '+mode)+')');if(['unknown','missing-dates','review','planned','no-phases'].includes(mode)){await run('scrollTo(0,0)');await screen('after-'+surface+'-'+mode+'-390-dark',true)}await harvest();}
  }
  // Actual keyboard navigation to the existing Other chooser and panel inputs.
  await navigate('after','dark','editor');await run("window.otherButton=document.querySelector('[aria-controls=\"dosing-panel-0-other\"]');otherButton.click();const controls=[...document.querySelectorAll('button,input,select,summary,a')].filter(e=>e.getClientRects().length&&e.tabIndex>=0&&!e.disabled);controls[controls.indexOf(otherButton)-1].focus();");
  await key('Tab','Tab',9);await run("check(document.activeElement===otherButton,'Keyboard Tab reaches existing Other chooser');check(otherButton.matches(':focus-visible'),'Existing chooser focus remains visible');");await key('Enter','Enter',13,'\r');await run("await tick();check(otherButton.getAttribute('aria-expanded')==='true','Keyboard Enter opens Other options');check(!document.querySelector('#dosing-panel-0-other').hidden,'Other panel opens immediately');");await key('Tab','Tab',9);await run("check(document.activeElement.getAttribute('aria-label')==='Compound name','Keyboard reaches original Compound name field');check(qaWrites.length===0,'Keyboard navigation makes no writes');");await harvest();
  // Existing Detail actions still invoke their exact callbacks, without invoking a backend.
  await navigate('after','dark','detail');await run("document.querySelector('.protocol-advanced').open=true;document.querySelector('.protocol-detail-edit').click();[...document.querySelectorAll('button')].find(e=>e.textContent==='Pause protocol').click();[...document.querySelectorAll('button')].find(e=>e.textContent==='Complete protocol').click();[...document.querySelectorAll('button')].find(e=>e.textContent==='Delete protocol').click();check(JSON.stringify(qaActions.map(a=>a[0]))===JSON.stringify(['edit','pause','complete','delete']),'Original Detail actions retain callbacks');check(qaWrites.length===0,'Synthetic action callbacks make no backend writes');");await harvest();
  // Reduced-motion avoids every new decorative animation, and keeps controls immediately usable.
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const surface of['detail','editor']){await navigate('after','dark',surface);await run("check([...document.querySelectorAll('[data-protocol-setup-artwork]')].every(e=>!e.getAnimations({subtree:true}).some(a=>a.playState==='running')),'Reduced motion immediately settled');layout('Reduced motion '+qaSurface);");await screen('after-'+surface+'-390-dark-reduced-motion',true);await harvest()}
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]});
  for(const surface of['detail','editor']){
    await navigate('after','dark',surface);await run(surface==='detail'?"document.querySelector('.protocol-phase').scrollIntoView({block:'center'});":"document.querySelector('.dosing-option-grid').scrollIntoView({block:'center'});");await run('await tick(1100);window.savedSemantics=semantic();');
    recording=[];await cdp('Page.startScreencast',{format:'jpeg',quality:90,maxWidth:390,maxHeight:844,everyNthFrame:1});await sleep(80);
    await run("qaReset('multiple',qaSurface);await tick();if(qaSurface==='detail')await openDetails();else await openEditor();art('phases').scrollIntoView({block:'center'});await tick(80);window.motionTargets=[...document.querySelectorAll('[data-protocol-setup-artwork]')].filter(e=>e.getClientRects().length);window.savedIds=[...document.querySelectorAll('[data-protocol-setup-artwork] [id]')].map(e=>e.id);window.savedReads=qaRequests.length;const animations=motionTargets.flatMap(e=>e.getAnimations({subtree:true}));check(animations.some(a=>a.playState==='running'),'Actual SVG entrance motion runs');check(animations.every(a=>a.effect.getComputedTiming().endTime<=1000),'Every new animation ends within one second');check(animations.every(a=>a.effect.getTiming().iterations!==Infinity),'No infinite decorative motion');");await sleep(1150);await run("check(motionTargets.every(e=>!e.getAnimations({subtree:true}).some(a=>a.playState==='running')),'Motion rests after one second');check(JSON.stringify(savedIds)===JSON.stringify([...document.querySelectorAll('[data-protocol-setup-artwork] [id]')].map(e=>e.id)),'SVG IDs stable through motion');check(JSON.stringify(savedSemantics)===JSON.stringify(semantic()),'Motion does not imply or change saved medical data');check(qaRequests.length===savedReads&&qaWrites.length===0,'Motion adds no reads or writes');window.restState=motionTargets.map(e=>[...e.querySelectorAll('[data-motion]')].map(n=>[getComputedStyle(n).transform,getComputedStyle(n).opacity]));");await sleep(200);await run("check(JSON.stringify(restState)===JSON.stringify(motionTargets.map(e=>[...e.querySelectorAll('[data-motion]')].map(n=>[getComputedStyle(n).transform,getComputedStyle(n).opacity]))),'Resting appearance remains stable after animation');");await cdp('Page.stopScreencast');const frames=recording;recording=null;fs.writeFileSync(path.join(evidence,surface+'-motion-frames.json'),JSON.stringify(frames));if(frames.length<3||new Set(frames.map(f=>f.data)).size<3)throw Error('Insufficient distinct recorded frames');
    const video=await run('const frames='+JSON.stringify(frames)+String.raw`;const canvas=document.createElement('canvas');canvas.width=390;canvas.height=844;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(30),type=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!type)throw Error('No video codec');const rec=new MediaRecorder(stream,{mimeType:type}),chunks=[];rec.ondataavailable=e=>chunks.push(e.data);const done=new Promise(r=>rec.onstop=r);rec.start();const start=performance.now();for(const f of frames){const delay=(f.timestamp-frames[0].timestamp)*1000-(performance.now()-start);if(delay>0)await tick(delay);const img=new Image();img.src='data:image/jpeg;base64,'+f.data;await img.decode();ctx.drawImage(img,0,0,390,844)}await tick(500);rec.stop();await done;stream.getTracks().forEach(t=>t.stop());const bytes=new Uint8Array(await new Blob(chunks,{type}).arrayBuffer());let binary='';for(const b of bytes)binary+=String.fromCharCode(b);return {data:btoa(binary),type,frames:frames.length,duration:(frames.at(-1).timestamp-frames[0].timestamp)*1000+500};`);
    const file=path.join(evidence,surface+'-animation.webm');fs.writeFileSync(file,Buffer.from(video.data,'base64'));videos.push({file,frames:video.frames,durationMs:video.duration,encoding:video.type,source:'Chrome CDP actual first-visible SVG entrance frames; retained timestamps'});await harvest();
  }
  await viewport(760);await navigate('lab-reference','dark');await run('await tick(1100)');await screen('visual-lab-v06-phases-other-reference',true);
  fs.writeFileSync(path.join(evidence,'semantic-baselines.json'),JSON.stringify(semanticBaselines,null,2));
  const report={passed:true,assertionCount:checks.length,baseline,sourceHashes:fixture.sourceHashes,fixtureArtifacts:fixture.artifacts,matrix,modes,checks,screenshots,videos,scope:'Actual hydrated ProtocolDetail and ManagePage with production CSS, synthetic fixtures and module-boundary Supabase/Next router mocks. Exact baseline source comparison. Headless Chrome mobile emulation, not physical Safari. No live backend and no new dependencies.'};fs.writeFileSync(path.join(evidence,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,assertions:checks.length,screenshots:screenshots.length,videos,report:path.join(evidence,'browser-report.json')},null,2));
})().catch(error=>{fs.writeFileSync(path.join(evidence,'browser-failure.txt'),String(error.stack||error));console.error(error);process.exitCode=1}).finally(()=>{ws?.close();chrome?.kill();server?.close();clearTimeout(deadline)});
