// Release 4B.2B.2: actual hydrated warning classification and correction controls.
// Synthetic records and a rejecting Supabase boundary; no live backend or private data.
// Run: npm run validate:browser -- tests/vial-safety.browser.cjs
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const cp = require('node:child_process'), http = require('node:http')
const root = process.cwd(), canonical = path.resolve(root, '../MyPepProtocol-Dev')
const toolRequire = require('node:module').createRequire(path.join(fs.existsSync(path.join(root, 'node_modules/typescript')) ? root : canonical, 'package.json'))
const WebSocket = toolRequire('next/dist/compiled/ws')
const sha256 = value => require('node:crypto').createHash('sha256').update(value).digest('hex')
const evidence = process.env.RELEASE4A_EVIDENCE_DIR || path.resolve(root, '../MyPepProtocol-Vial-Safety-Release4A-Evidence')
const shots = path.join(evidence, 'screenshots')
fs.mkdirSync(shots, { recursive: true })
const runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'release4a-browser-'))
const entry = path.join(runtime, 'fixture.tsx')
const baseline = '05223a02b01da23ce39349d60d1245b765a4604e'
const sourceHashes = { 'tests/vial-safety.browser.cjs': sha256(fs.readFileSync(__filename)) }
const screenshots = [], checks = [], matrix = [], network = []
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
let chrome, ws, server
const deadline = setTimeout(() => { console.error('Release 4A browser deadline exceeded'); process.exit(1) }, 180000)
fs.writeFileSync(entry, `
import React from 'react'; import {createRoot} from 'react-dom/client';
import Hero from ${JSON.stringify(path.join(root, 'components/dashboard/HeroProtocolCard.tsx'))};
import ManagePage from ${JSON.stringify(path.join(root, 'app/protocol/manage/page.tsx'))};
import styles from ${JSON.stringify(path.join(root, 'app/protocol/today-v2.module.css'))};
import theme from ${JSON.stringify(path.join(root, 'components/app/design-system-v2.module.css'))};
const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-11-04T12:00:00']))}static now(){return new NativeDate('2026-11-04T12:00:00').getTime()}};
window.qaWrites=[];window.qaRequests=[];window.qaActions=[];window.qaMode='normal';window.qaNavigation=new URLSearchParams(location.search).get('qaNavigation');
const dosing=(extra={})=>({version:2,mode:'medication',review_status:'confirmed',dose:'2',dose_unit:'mg',syringe_markings:'',syringe_scale:'',injection_volume:'0.4',vial_strength:'10',vial_unit:'mg',bac_water_ml:'2',concentration_value:'',concentration_unit:'',vial_label:'Synthetic vial',preparation:'mixing',is_premixed:false,...extra});
window.qaProtocol=(mode='normal')=>{
 let entry=dosing();const compound={id:'synthetic-compound',name:'Synthetic compound',vial_strength:10,vial_unit:'mg',bac_water_ml:2,reconstitution_date:'2026-10-30',vials_in_stock:2,doses_taken_override:0,notes:'Synthetic fixture; no real treatment.'};
 if(mode.startsWith('invalid-'))entry=dosing({[mode.slice(8)]:mode==='invalid-syringe_scale'?'0':'-2'});
 if(mode==='invalid-saved-amount')entry=dosing({mode:'volume',dose:'-2'});
 if(mode==='missing'){entry=dosing({dose:'',dose_unit:'',injection_volume:'',vial_strength:'',vial_unit:'',bac_water_ml:''});Object.assign(compound,{vial_strength:null,vial_unit:null,bac_water_ml:null,reconstitution_date:null,vials_in_stock:null,doses_taken_override:null})}
 if(mode==='conflict'){entry=dosing({injection_volume:'0.2',vial_strength:'20',bac_water_ml:'4'});Object.assign(compound,{vial_strength:10,bac_water_ml:2})}
 if(mode==='unknown'){Object.assign(compound,{doses_taken_override:null,vials_in_stock:0});entry=dosing()}
 if(mode==='scale')entry=dosing({mode:'syringe',dose:'',dose_unit:'',syringe_markings:'20',syringe_scale:'',injection_volume:''});
 if(mode==='labelled-legacy')entry=dosing({mode:'volume',dose:'',dose_unit:'',injection_volume:'0.2',vial_strength:'',vial_unit:'',bac_water_ml:'',concentration_value:'5',concentration_unit:'',preparation:undefined,is_premixed:undefined});
 const history={id:'synthetic-historical-phase',name:'Recorded historical phase',start_week:1,end_week:2,dose:18,dose_unit:'IU',dose_semantics_version:null,injection_volume_ml:null,syringe_units:18,syringe_scale:null,frequency:'daily',route:'SubQ'};
 const phase={id:'synthetic-current-phase',name:'Recorded current phase',start_week:3,end_week:null,dosing_entry:entry,dose:null,dose_unit:null,dose_semantics_version:null,frequency:'daily',route:'SubQ',days_of_week:[0,1,2,3,4,5,6],time_of_day:'Morning'};
 if(mode==='legacy-invalid')Object.assign(phase,{dosing_entry:null,dose:-2,dose_unit:'mg',dose_semantics_version:1});
 return {id:'synthetic-protocol',name:'Synthetic protocol',status:'active',start_date:'2026-10-01',compounds:[{...compound,phases:[history,phase]}]};
};
window.qaLogs=[{compound_id:'synthetic-compound',date:'2020-01-01',taken:true}];window.qaRecord=qaProtocol();window.qaOriginal=JSON.stringify({protocol:qaRecord,logs:qaLogs});
function Fixture(){const[state,setState]=React.useState({surface:'hero',version:0});React.useEffect(()=>{window.qaReset=(mode='normal')=>{qaMode=mode;qaRecord=qaProtocol(mode);qaOriginal=JSON.stringify({protocol:qaRecord,logs:qaLogs});qaWrites=[];qaRequests=[];qaActions=[];history.replaceState(null,'','/fixture');setState(s=>({surface:'hero',version:s.version+1}))};window.qaNavigate=url=>{qaActions.push(['navigate',url]);history.replaceState(null,'',url);if(url.startsWith('/protocol/manage'))setState(s=>({surface:'editor',version:s.version+1}))};const listener=e=>{const link=e.target.closest?.('a[href]');if(link){e.preventDefault();qaNavigate(link.getAttribute('href'))}};document.addEventListener('click',listener);return()=>document.removeEventListener('click',listener)},[]);
 return <div className={theme.theme}>{state.surface==='editor'?<ManagePage key={state.version}/>:<main className={'today-main '+styles.page}><div className={styles.container}><section className={'today-card '+styles.activeProtocols}><h2>Active protocol</h2><div className={styles.selectedSnapshot}><Hero key={state.version} snapshot activeProtocols={[qaRecord]} activeCompoundTab='synthetic-compound' compoundIndex={0} logs={{}} allLogs={qaLogs} totalLost={null}/></div></section></div></main>}</div>;
}
window.qaRouter={push:url=>qaNavigate(url),replace:url=>{history.replaceState(null,'',url)},refresh:()=>{}};
sessionStorage.setItem('mpp:first-protocol:synthetic-owner','1');createRoot(document.getElementById('root')).render(<Fixture/>);
`)
function htmlFor() {
 const ts = toolRequire('typescript'), modules = [], ids = new Map(), styles = [], globals = []
 function resolve(specifier, importer) {
  const base = specifier.startsWith('.') ? path.resolve(path.dirname(importer), specifier) : specifier
  for (const suffix of ['', '.ts', '.tsx', '.js']) try { return toolRequire.resolve(base + suffix, { paths: [path.dirname(importer), root, canonical] }) } catch {}
  throw Error('Cannot resolve ' + specifier + ' from ' + importer)
 }
 function bundle(file) {
  if (ids.has(file)) return ids.get(file)
  const id = modules.length; ids.set(file, id); modules.push(null)
  let code = fs.readFileSync(file, 'utf8')
  const relative = path.relative(root, file).replaceAll('\\', '/')
  if (!relative.startsWith('..') && !relative.startsWith('node_modules')) sourceHashes[relative] = sha256(code)
  if (file === path.join(root, 'lib/supabase.ts')) code = String.raw`
   exports.createClient=()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}},error:null})},rpc:(...args)=>{qaWrites.push(['rpc',args]);throw Error('Unexpected RPC write')},from:table=>{
    const q={select(){return q},eq(){return q},in(){return q},order(){return q},limit(){return q},insert(v){qaWrites.push({table,v});throw Error('Unexpected insert')},upsert(v){qaWrites.push({table,v});throw Error('Unexpected upsert')},update(v){qaWrites.push({table,v});throw Error('Unexpected update')},delete(){qaWrites.push({table});throw Error('Unexpected delete')},single:async()=>{qaRequests.push(table);return {data:table==='protocols'?{continued_from_protocol_id:null}:null,error:null}},then(resolve,reject){qaRequests.push(table);return Promise.resolve({data:table==='protocols'?[qaRecord]:[],error:null}).then(resolve,reject)}};return q}});
  `
  if(file===toolRequire.resolve('next/navigation'))code="exports.useRouter=()=>qaRouter;exports.usePathname=()=>location.pathname;exports.useSearchParams=()=>new URLSearchParams(location.search);";
  if(file===toolRequire.resolve('next/link'))code="const React=require('react');exports.__esModule=true;exports.default=({prefetch,...props})=>React.createElement('a',props);";
  if (file.endsWith('.module.css')) {
   const names = {}, globalNames = []
   let css = code.replace(/:global\(([^)]+)\)/g, (_, value) => 'GLOBALTOKEN' + (globalNames.push(value) - 1))
   css = css.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => '.' + (names[name] = 'm' + id + '_' + name))
   styles.push(css.replace(/GLOBALTOKEN(\d+)/g, (_, i) => globalNames[i]));code='module.exports='+JSON.stringify(names)
  } else if(file.endsWith('.css')){globals.push(code);code='module.exports={}'}
  if(/\.(tsx?|m?js)$/.test(file))code=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const map={};for(const match of code.matchAll(/require\(["']([^"']+)["']\)/g)){if(require('node:module').isBuiltin(match[1]))throw Error('Unexpected browser builtin '+match[1]);const dep=JSON.parse('"'+match[1]+'"');map[dep]=bundle(resolve(dep,file))}
  modules[id]='function(module,exports){const require=name=>load('+JSON.stringify(map)+'[name]);'+code+'\n}';return id
 }
 const id=bundle(entry)
 const script="const process={env:{NODE_ENV:'production'}};const modules=["+modules.join(',')+"],cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports);return module.exports}load("+id+');'
 const css=['app/globals.css','app/mobile-app.css','app/protocol/manage/protocols.css'].map(file=>{const code=fs.readFileSync(path.join(root,file),'utf8');sourceHashes[file]=sha256(code);return code}).concat(globals,styles).join('\n')
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Release 4A synthetic vial safety</title><style>'+css+'\nbody{margin:0;font-family:Inter,Arial,sans-serif}main.today-main{padding-top:16px;min-height:100dvh}</style></head><body><div id="root"></div><script>window.errors=[];window.onerror=(...args)=>errors.push(args.slice(0,3));window.onunhandledrejection=e=>errors.push(String(e.reason));window.fetch=()=>{throw Error("Unexpected browser fetch")};window.XMLHttpRequest=function(){throw Error("Unexpected browser XHR")};</script><script>'+script.replaceAll('</script','<\\/script')+'</script></body></html>'
}
if(process.argv.includes('--build-fixture')){
 const html=htmlFor();fs.writeFileSync(path.join(evidence,'vial-safety-fixture.html'),html)
 fs.writeFileSync(path.join(evidence,'vial-safety-source-hashes.json'),JSON.stringify({baseline,sourceHashes,fixture:sha256(html)},null,2))
 clearTimeout(deadline);process.exit(0)
}
function installChecks(){
 window.qaChecks=[];window.check=(ok,label)=>{if(!ok)throw Error(label);qaChecks.push(label)};
 window.tick=ms=>new Promise(resolve=>setTimeout(resolve,ms??60));
 window.waitFor=async predicate=>{for(let i=0;i<120;i++){if(predicate())return;await tick(20)}throw Error('Fixture timeout '+JSON.stringify(errors)+' '+document.body.innerText.slice(0,700))};
 window.fact=label=>[...document.querySelectorAll('.today-snapshot-fact,.today-snapshot-facts>div')].find(e=>e.querySelector('dt')?.textContent===label)?.querySelector('dd')?.textContent;
 window.preserved=label=>{check(qaWrites.length===0,label+' makes no writes');check(JSON.stringify({protocol:qaRecord,logs:qaLogs})===qaOriginal,label+' preserves historical values and log records');check(errors.length===0,label+' no runtime errors')};
 window.layout=label=>{
  check(document.documentElement.scrollWidth<=innerWidth,label+' no horizontal overflow');
  for(const e of document.querySelectorAll('button,a,input,select,dialog')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect();check(r.left>=-1&&r.right<=innerWidth+1,label+' control stays within viewport '+(e.getAttribute('aria-label')||e.textContent.trim().slice(0,45)))}
  const walker=document.createTreeWalker(document.querySelector('dialog[open]')||document.querySelector('main'),NodeFilter.SHOW_TEXT);
  for(let n;(n=walker.nextNode());){if(!n.textContent.trim()||n.parentElement.closest('svg,[aria-hidden="true"],script'))continue;const range=document.createRange();range.selectNodeContents(n);for(const r of range.getClientRects())if(r.width&&r.height)check(r.left>=-1&&r.right<=innerWidth+1,label+' text remains in viewport '+n.textContent.trim().slice(0,35))}
 };
 window.heroCheck=(mode,label)=>{
  const hero=document.querySelector('.today-protocol-snapshot');check(Boolean(hero),label+' actual Hero renders');
  check(Boolean(hero.querySelector('[data-premium-vial="true"]')),label+' premium vial artwork retained');
  check(hero.textContent.includes('Remaining unknown'),label+' unknown remaining stays unknown');
  check(!hero.textContent.includes('Estimated remaining'),label+' no unattributable consumption estimate');
  check(!/Expired|EXPIRED|days left|Day \d+ of 28|Day \d+\/28/.test(hero.textContent),label+' no unsupported expiry or countdown');
  check(/Unknown|not recorded/i.test(fact('Vial expiration')||fact('Expiration')||hero.querySelector('.vial-lifecycle')?.textContent||''),label+' expiration uncertainty visible');
  if(mode==='missing')check(fact('Vials in stock')==='Not recorded',label+' unknown stock stays unknown');
  if(mode==='unknown')check(fact('Vials in stock')==='0',label+' explicit zero stock preserved');
  if(mode==='normal')check(hero.querySelector('.today-snapshot-medication').textContent.includes('2 mg'),label+' recorded normal medication remains visible');
  if(mode==='conflict'){check(/0\.2 mL/.test(hero.textContent)&&/2 mg/.test(hero.textContent),label+' independent recorded amounts remain visible');check(hero.querySelector('figure figcaption').textContent.includes('10 mg')&&!hero.querySelector('figure figcaption').textContent.includes('20 mg'),label+' historical phase preparation never replaces recorded compound amount');}
  check(Boolean(document.querySelector('[data-vial-remaining-reason]'))&&document.querySelector('[data-vial-remaining-reason]').textContent.includes('Saved doses are not linked to an individual vial'),label+' unavailable remaining has a visible explanation');
  check(!document.querySelector('.today-snapshot-notice,.dose-issue,.dosing-panel-issue'),label+' valid or absent historical facts have no warning');
  check(!document.querySelector('a[href*="review="]'),label+' no unsupported repair link');
  const remaining=document.querySelector('[data-vial-remaining-reason]');check(remaining.querySelector('details')&&!remaining.querySelector('details').open,label+' remaining limitation is optional');check(!remaining.querySelector('a'),label+' remaining limitation has no edit promise');
  const action=hero.querySelector('.vial-new-button');check(action&&!action.disabled,label+' New Vial explanation remains accessible');
  layout(label);preserved(label);
 };
}
;(async()=>{
 cp.execFileSync(process.execPath,['--max-old-space-size=384',__filename,'--build-fixture'],{cwd:root,windowsHide:true,stdio:'inherit',timeout:90000});
 const fixture=JSON.parse(fs.readFileSync(path.join(evidence,'vial-safety-source-hashes.json'),'utf8'));
 if(fixture.baseline!==baseline)throw Error('Wrong fixture baseline');
 for(const[file,expected]of Object.entries(fixture.sourceHashes))if(sha256(fs.readFileSync(path.join(root,file)))!==expected)throw Error('Source changed after fixture generation '+file);
 const html=fs.readFileSync(path.join(evidence,'vial-safety-fixture.html'),'utf8');if(sha256(html)!==fixture.fixture)throw Error('Fixture hash mismatch');
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 chrome=cp.spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--disable-background-timer-throttling','--disable-renderer-backgrounding','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+path.join(runtime,'profile'),'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 chrome.stderr.on('data',data=>fs.appendFileSync(path.join(evidence,'vial-safety-chrome.log'),data));let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(runtime,'profile/DevToolsActivePort'),'utf8');if(port.includes('/devtools/'))break}catch{}await sleep(100)}if(!port)throw Error('Chrome did not start');
 const targets=await(await fetch('http://127.0.0.1:'+port.split('\n')[0]+'/json')).json();ws=new WebSocket(targets.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 let seq=0;const pending=new Map();
 const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method))},30000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}))});
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(!p)return;clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Network.requestWillBeSent')network.push(m.params.request.url)};
 const run=async code=>{const r=await cdp('Runtime.evaluate',{expression:'(async()=>{'+code+'})()',awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const harvest=async()=>{checks.push(...await run('return qaChecks'));await run('qaChecks=[]')};
 const viewport=(width)=>cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
 const key=async(key,code,n,modifiers=0)=>{for(const type of['keyDown','keyUp'])await cdp('Input.dispatchKeyEvent',{type,key,code,windowsVirtualKeyCode:n,modifiers,...(type==='keyDown'&&key==='Enter'?{text:'\r'}:{})})};
 const screen=async(name,full=true)=>{const metrics=full?await cdp('Page.getLayoutMetrics'):null;const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:full,...(full?{clip:{x:0,y:0,width:metrics.cssContentSize.width,height:metrics.cssContentSize.height,scale:1}}:{})});const file=path.join(shots,name+'.png');fs.writeFileSync(file,Buffer.from(r.data,'base64'));screenshots.push(file)};
 await cdp('Network.enable');await cdp('Network.setBlockedURLs',{urls:['https://*']});await cdp('Emulation.setFocusEmulationEnabled',{enabled:true});
 await viewport(390);await cdp('Page.navigate',{url:'http://127.0.0.1:'+server.address().port+'/fixture?qaNavigation=initial'});
 let ready=false;for(let i=0;i<200;i++){try{const r=await cdp('Runtime.evaluate',{expression:'typeof qaReset==="function"',returnByValue:true});if(r.result?.value){ready=true;break}}catch{}await sleep(40)}if(!ready)throw Error('Synthetic fixture did not initialize');
 await run('('+installChecks.toString()+')();');
 for(const theme of['dark','light'])for(const width of[390,320]){
  await viewport(width);await run('document.documentElement.dataset.theme='+JSON.stringify(theme));
  for(const mode of['missing','conflict','unknown','normal']){
   const label=theme+' '+width+' '+mode;console.log('Browser '+label);
   await run('qaReset('+JSON.stringify(mode)+');await tick(120);heroCheck('+JSON.stringify(mode)+','+JSON.stringify(label)+');scrollTo(0,0)');
   await screen(mode+'-'+width+'-'+theme);matrix.push({theme,width,mode});await harvest();
  }
  const label=theme+' '+width+' containment';
  await run("qaReset('normal');await tick(120);window.trigger=document.querySelector('.vial-new-button');trigger.scrollIntoView({block:'center'});trigger.focus();");
  await key('Enter','Enter',13);await run("await waitFor(()=>document.querySelector('dialog[open]'));window.dialog=document.querySelector('dialog[open]');check(dialog.getAttribute('aria-modal')==='true','Containment is modal');check(dialog.getAttribute('aria-labelledby')&&document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent.includes('temporarily unavailable'),'Containment has explanatory title');check(!dialog.querySelector('input,select,textarea'),'Containment has no mutating input controls');check(dialog.textContent.includes('previous')||dialog.textContent.includes('existing'),'Containment explains retained records');check([...dialog.querySelectorAll('a')].some(a=>a.getAttribute('href').startsWith('/protocol/manage')),'Containment preserves protocol access');check(dialog.contains(document.activeElement),'Keyboard focus enters containment');window.modalControls=[...dialog.querySelectorAll('button,a[href]')];modalControls.at(-1).focus();");
  await key('Tab','Tab',9);await run("check(document.activeElement===modalControls[0],'Tab wraps inside containment');");
  await key('Tab','Tab',9,8);await run("check(document.activeElement===modalControls.at(-1),'Shift Tab wraps inside containment');layout('Containment layout');preserved('Containment opening');");
  if(width===390)await screen('new-vial-containment-390-'+theme,false);matrix.push({theme,width,mode:'containment'});
  await key('Escape','Escape',27);await run("await tick();check(!document.querySelector('dialog[open]'),'Escape dismisses containment');check(document.activeElement===trigger,'Containment returns focus');preserved('Containment dismissal');");await harvest();
 }
 // Every actionable numeric warning reaches its existing editable field without changing mode or preparation.
 await viewport(390);
 for(const [key,field]of[['dose','Medication dose'],['saved-amount','Saved amount'],['syringe_markings','Syringe markings'],['syringe_scale','Syringe scale'],['injection_volume','Injection volume (mL)'],['vial_strength','Vial amount'],['bac_water_ml','BAC water in mL'],['concentration_value','Concentration value']]){
  await run('qaReset('+JSON.stringify('invalid-'+key)+');await tick(120);window.recovery=[...document.querySelectorAll(".today-snapshot-actions a")].find(a=>new URL(a.href).searchParams.get("review")==='+JSON.stringify(field)+');check(Boolean(recovery),'+JSON.stringify('Specific action for '+field)+');recovery.click();await waitFor(()=>document.querySelector(".protocol-editor"));await tick(120);check(document.activeElement.getAttribute("aria-label")==='+JSON.stringify(field)+','+JSON.stringify('Visible control for '+field)+');check(!document.activeElement.closest("[hidden]"),"Recovery field is exposed");check(document.querySelector(".dosing-methods [aria-pressed=true]")?.textContent.includes(qaMode==="invalid-saved-amount"?"Volume":"Medication"),"Recovery retains measurement mode");check(qaMode!=="invalid-saved-amount"||document.querySelector("label[for]").textContent==="Saved amount (meaning unverified)","Saved amount keeps neutral label");check([...document.querySelectorAll("[aria-label]")].find(e=>e.getAttribute("aria-label")==="Preparation source").checked===false,"Recovery retains preparation");layout("Numeric recovery");preserved("Numeric recovery");');
  await screen('editor-invalid-'+key+'-390-light');await harvest();
 await run("window.control=document.activeElement;Object.getOwnPropertyDescriptor(control.tagName===\"SELECT\"?HTMLSelectElement.prototype:HTMLInputElement.prototype,\"value\").set.call(control,control.tagName===\"SELECT\"?\"100\":\"2\");control.dispatchEvent(new Event(control.tagName===\"SELECT\"?\"change\":\"input\",{bubbles:true}));await tick(100);check(!document.querySelector(\"[role=alert]\"),\"Corrected numeric value clears validation error\");check(!document.querySelector(\".dose-issue,.dosing-panel-issue\"),\"Corrected numeric value clears actionable warning\");preserved(\"Synthetic edit remains local until save\");");await harvest();
 }
 for(const mode of['scale','labelled-legacy']){
  await run('qaReset('+JSON.stringify(mode)+');await tick(120);check(![...document.querySelectorAll("a")].find(e=>e.href.includes("review=")),"Missing optional facts offer no false correction");check(!document.querySelector(".today-snapshot-notice"),"Missing optional facts have no warning");preserved("Neutral optional facts");');await harvest();
 }
 await run("qaReset(\"legacy-invalid\");await tick(120);check(![...document.querySelectorAll(\"a\")].some(e=>e.href.includes(\"review=\")),\"Legacy invalid value has no unsupported correction link\");[...document.querySelectorAll(\".today-snapshot-actions a\")].find(e=>e.textContent===\"Manage protocol\").click();await waitFor(()=>document.querySelector(\"[data-historical-correction-unavailable]\"));check(document.querySelector(\"[data-historical-correction-unavailable]\").textContent.includes(\"cannot correct this older record\"),\"Editor keeps historical correction limitation\");check(!document.querySelector(\".dose-review-link\"),\"Editor never promotes legacy draft into actionable V2\");preserved(\"Legacy limitation\");");await screen("editor-legacy-invalid-390-light");await harvest();
 // Old New Vial URLs must not revive the removed editor mutation pathway.
 for(const parameters of['reconstitution_vial=20','reconstitution_water=4','reconstitution_date=2026-11-04']){
  await run('qaReset("normal");await tick();qaNavigate("/protocol/manage?compound=synthetic-compound&'+parameters+'");await waitFor(()=>document.querySelector("[data-vial-handoff-blocked]"));check(!document.querySelector(".protocol-editor"),"Legacy New Vial handoff does not open mutation editor");check(document.body.textContent.includes("Synthetic compound"),"Legacy handoff retains access to existing protocol");preserved("Legacy New Vial handoff");');await harvest();
 }
 // Repeated opening preserves both zero and unknown stock, without a read or save.
 for(const mode of['missing','unknown']){
  await run('qaReset('+JSON.stringify(mode)+');await tick();document.querySelector(".vial-new-button").click();await waitFor(()=>document.querySelector("dialog[open]"));[...document.querySelectorAll("dialog button")].find(b=>b.textContent==="Close").click();await tick();preserved('+JSON.stringify('Containment stock '+mode)+');');await harvest();
 }
 await run('qaReset("normal");await tick();document.querySelector(".vial-new-button").click();await waitFor(()=>document.querySelector("dialog[open]"));document.querySelector("dialog a").click();await waitFor(()=>document.querySelector(".protocols-page"));await tick();check(document.body.textContent.includes("Synthetic compound"),"Containment View protocols reaches existing records");preserved("Containment protocol navigation");');await harvest();
 await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 for(const theme of['dark','light']){
  await run('document.documentElement.dataset.theme='+JSON.stringify(theme)+';qaReset("conflict");await tick(120);heroCheck("conflict",'+JSON.stringify('Reduced motion '+theme)+');check([...document.querySelectorAll("[data-premium-vial]")].every(e=>!e.getAnimations({subtree:true}).some(a=>a.playState==="running")),"Reduced motion keeps premium vial settled");');await harvest();
 }
 if(network.some(url=>!url.startsWith('http://127.0.0.1:'+server.address().port+'/')&&!url.startsWith('data:')))throw Error('Unexpected network request '+JSON.stringify(network));
 for(const[file,expected]of Object.entries(fixture.sourceHashes))if(sha256(fs.readFileSync(path.join(root,file)))!==expected)throw Error('Source changed during browser run '+file);
 const report={passed:true,baseline,assertionCount:checks.length,checks,matrix,screenshots,network,sourceHashes:fixture.sourceHashes,fixtureHash:fixture.fixture,scope:'Actual hydrated HeroProtocolCard, EnhancedVial, VialInventory, DoseSummary and ManagePage; production CSS; synthetic fixture records; rejecting Supabase writes and blocked external network. Headless Chrome mobile emulation, not physical Safari.'};
 fs.writeFileSync(path.join(evidence,'vial-safety-browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,assertions:checks.length,screenshots:screenshots.length,report:path.join(evidence,'vial-safety-browser-report.json')},null,2));
})().catch(error=>{fs.writeFileSync(path.join(evidence,'vial-safety-browser-failure.txt'),String(error.stack||error));console.error(error);process.exitCode=1}).finally(()=>{ws?.close();chrome?.kill();server?.close();clearTimeout(deadline)});
