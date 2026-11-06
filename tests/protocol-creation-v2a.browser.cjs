// Synthetic local preview of real creation components. No services or health data.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http'), cp = require('node:child_process'), ts = require('typescript')
const root = path.resolve(__dirname, '..'), runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mpp-v2a-'))
const entry = path.join(runtime, 'fixture.tsx'), evidence = path.join(runtime, 'evidence')
fs.mkdirSync(evidence)
fs.writeFileSync(entry, `import React from 'react'; import {createRoot} from 'react-dom/client';
import View from ${JSON.stringify(path.join(root, 'components/protocols/ProtocolQuickStart').replaceAll('\\','/'))};
import {newCompound,protocolCompoundPayload} from ${JSON.stringify(path.join(root, 'lib/protocols/form').replaceAll('\\','/'))};
import Hero from ${JSON.stringify(path.join(root,'components/dashboard/HeroProtocolCard').replaceAll('\\','/'))};
import Detail from ${JSON.stringify(path.join(root,'components/protocols/ProtocolDetail').replaceAll('\\','/'))};
import Vial from ${JSON.stringify(path.join(root,'components/today/EnhancedVial').replaceAll('\\','/'))};
import {entryFormState} from ${JSON.stringify(path.join(root,'lib/health/dosingEntry').replaceAll('\\','/'))};
import theme from ${JSON.stringify(path.join(root,'components/app/design-system-v2.module.css').replaceAll('\\','/'))};
import todayStyles from ${JSON.stringify(path.join(root,'app/protocol/today-v2.module.css').replaceAll('\\','/'))};
import {SectionCard} from ${JSON.stringify(path.join(root,'components/app/DesignSystem').replaceAll('\\','/'))};
function Fixture(){const[value,setValue]=React.useState({startDate:'2026-11-05',compounds:[{...newCompound(),name:'Synthetic compound'}]});const[surface,setSurface]=React.useState('creation');window.showSaved=setSurface;window.resetCreation=()=>{setValue({startDate:'2026-11-05',compounds:[{...newCompound(),name:'Synthetic compound'}]});setSurface('creation')};
const noop=()=>{};let content;
if(surface==='creation')content=<View value={value} today="2026-11-05" onChange={setValue} onClose={noop} onSave={()=>{window.saved=protocolCompoundPayload(value.compounds)}}/>;
else {const payload=JSON.parse(JSON.stringify(window.saved[0]));const phase={...payload.phase,id:'phase',name:'Phase 1'};delete payload.phase;window.reloaded=entryFormState(phase);const compound={...payload,id:'compound',vial_strength:null,vial_unit:null,bac_water_ml:null,phases:[phase]};const protocol={id:'protocol',name:'Synthetic compound',start_date:value.startDate,status:'active',compounds:[compound]};
content=surface==='detail'?<Detail protocol={protocol} today="2026-11-05" onBack={noop} onEdit={noop} onComplete={noop} onPause={noop} onResume={noop} onReactivate={noop} onDelete={noop} onReload={noop}/>:surface==='vials'?<><h1>Unknown versus empty</h1><Vial name="Unknown remaining" remainingFraction={null} remainingMl={null}/><Vial name="Known empty (synthetic)" remainingFraction={0} remainingMl={0}/></>:<Hero activeProtocols={[protocol]} activeCompoundTab="compound" compoundIndex={0} snapshot={surface==='hero'} logs={{}} allLogs={[]} totalLost={null}/>}
if(surface.startsWith('hero'))return <div className={'mobile-app-shell today-surface '+theme.theme}><main className={'today-main '+todayStyles.page}><div className={todayStyles.container}><SectionCard className={todayStyles.activeProtocols}><div className={surface==='hero'?todayStyles.selectedSnapshot:undefined}>{content}</div></SectionCard></div></main></div>;
return <main className={'protocols-page protocols-focused '+theme.theme}><div className="protocols-container protocols-creation-container">{content}</div></main>};createRoot(document.getElementById('root')).render(<Fixture/>);
`)
const modules = [], ids = new Map(), extraStyles = []
function bundle(file) {
  if (ids.has(file)) return ids.get(file)
  const id=modules.length; ids.set(file,id); modules.push(null)
  let code=fs.readFileSync(file,'utf8')
  if(file===path.join(root,'lib/supabase.ts')) code="module.exports={createClient:()=>({from:table=>{if(!['protocol_events','injection_logs'].includes(table))throw Error('Unexpected synthetic table');const q={};for(const method of ['select','eq','in','order'])q[method]=()=>q;q.limit=()=>Promise.resolve({data:[],error:null});return q}})}"
  if(file.endsWith(path.join('next','link.js'))) code="module.exports=props=>require('react').createElement('a',props)"
  if(file.endsWith('.module.css')) { const names={},globals=[];code=code.replace(/:global\(([^)]+)\)/g,(_,value)=>'GLOBALTOKEN'+(globals.push(value)-1));extraStyles.push(code.replace(/\.([a-zA-Z][\w-]*)/g,(_,name)=>'.'+(names[name]='qa'+id+'_'+name)).replace(/GLOBALTOKEN(\d+)/g,(_,i)=>globals[i]));code='module.exports='+JSON.stringify(names) }
  if (/\.(tsx?|js)$/.test(file)) code=ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const map={}
  for(const match of code.matchAll(/require\(["']([^"']+)["']\)/g)) {
    const dep=match[1],base=dep.startsWith('.')?path.resolve(path.dirname(file),dep):dep
    let resolved
    for(const suffix of ['', '.ts','.tsx','.js']){try{resolved=require.resolve(base+suffix,{paths:[root,path.dirname(file)]});break}catch{}}
    if(!resolved || require('node:module').isBuiltin(dep))throw Error('Unexpected fixture dependency '+dep)
    map[dep]=bundle(resolved)
  }
  modules[id]='function(module,exports){const require=name=>load('+JSON.stringify(map)+'[name]);'+code+'\n}';return id
}
const id=bundle(entry), script="const process={env:{NODE_ENV:'production'}};const modules=["+modules.join(',')+"],cache={};function load(id){if(cache[id])return cache[id].exports;const module=cache[id]={exports:{}};modules[id](module,module.exports);return module.exports}load("+id+');'
const css=['app/globals.css','app/mobile-app.css','app/protocol/manage/protocols.css'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).concat(extraStyles).join('\n')
const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic V2A preview</title><style>'+css+'*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}</style><body><div id="root"></div><script>window.errors=[];window.onerror=(...a)=>errors.push(a[0]);window.onunhandledrejection=e=>errors.push(String(e.reason));window.fetch=()=>{throw Error("Network disabled")};window.XMLHttpRequest=()=>{throw Error("Network disabled")};</script><script>'+script.replaceAll('</script','<\\/script')+'</script></body></html>'
fs.writeFileSync(path.join(evidence,'preview.html'),html)
let server,chrome,ws
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function main(){
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port
 if(process.argv.includes('--serve')){console.log('Synthetic preview: '+url);return}
 chrome=cp.spawn(process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+path.join(runtime,'profile'),'about:blank'],{windowsHide:true,stdio:'ignore'})
 let port
 for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(runtime,'profile/DevToolsActivePort'),'utf8').split('\n')[0];if(port)break}catch{}await sleep(100)}
 if(!port)throw Error('Chrome startup failed')
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json')).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r)
 let serial=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(pending.has(m.id)){pending.get(m.id)(m);pending.delete(m.id)}}
 const send=async(method,params={})=>{const id=++serial;const result=new Promise(r=>pending.set(id,r));ws.send(JSON.stringify({id,method,params}));const m=await result;if(m.error)throw Error(JSON.stringify(m.error));return m.result}
 const run=async(expression)=>{const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value}
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url});
 for(let i=0;i<100;i++){if(await run('Boolean(document.querySelector("h1"))'))break;await sleep(100)}
 await run(`window.clickText=s=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===s);if(!b)throw Error('Missing button '+s);b.click()};window.fill=(name,value)=>{const e=document.querySelector('[aria-label="'+name+'"]');if(!e)throw Error('Missing field '+name);Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))};window.check=(ok,message)=>{if(!ok)throw Error(message)};`)
 const act=async(code)=>{await run(code);await sleep(80)}
 const shot=async(name)=>{await run('window.scrollTo(0,0);document.querySelector(".protocols-focused")?.scrollTo(0,0)');await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(150);const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(evidence,name+'.png'),Buffer.from(s.data,'base64'))}
 await run(`window.checkField=name=>{const e=document.querySelector('[aria-label="'+name+'"]');check(e.getAttribute('aria-invalid')==='true','Field not marked invalid: '+name);check(e.getAttribute('aria-describedby').split(' ').some(id=>document.getElementById(id)?.getAttribute('role')==='alert'),'Missing associated error: '+name);check(document.activeElement===e,'Offending field did not receive focus: '+name)}`)
 await run(`window.checkLayout=()=>{const main=document.querySelector('main');check(document.documentElement.scrollWidth<=390&&main.scrollWidth<=main.clientWidth,'Horizontal overflow');const art=document.querySelector('.creation-stage-visual');if(art){check(art.offsetHeight<=220,'Artwork adds excessive scroll');const children=[...art.children].map(e=>e.getBoundingClientRect());check(children[0].right<=children[1].left,'Artwork overlaps text')}for(const e of document.querySelectorAll('input,select,button,summary')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect();check(r.left>=0&&r.right<=391,'Control exceeds viewport')}};checkLayout()`)
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await run(`check(document.activeElement.tagName==='BUTTON','Keyboard cannot reach first control')`)
 await shot('compound-selection')
 await act(`clickText('Yes')`);await act(`fill('Amount in the vial','-1')`);await act(`clickText('Continue')`)
 await run(`check(document.querySelector('h1').textContent==='Preparation','Invalid preparation advanced');checkField('Amount in the vial')`);await shot('preparation-error')
 await act(`fill('Amount in the vial','10')`);await act(`fill('Bacteriostatic water added','-1')`);await act(`clickText('Continue')`)
 await run(`checkField('Bacteriostatic water added')`)
 await act(`fill('Bacteriostatic water added','2')`);await act(`fill('Amount in the vial','10')`);await act(`fill('Amount in the vial unit','mg')`);await act(`fill('Reconstitution date','2026-11-01')`);await run(`check(document.body.innerText.includes('28-day check reminder: Nov 29'),'Reminder missing');checkLayout()`);await shot('preparation')
 await act(`clickText('Continue')`);await run(`check(document.querySelector('[aria-label="How do you take it?"]').value==='','Route was inferred')`);await act(`clickText('Syringe marking')`);await act(`fill('Syringe marking','-1')`);await act(`clickText('Continue')`);await run(`checkField('Syringe marking')`);await act(`fill('Syringe marking','20')`)
 await run(`check([...document.querySelectorAll('button')].find(b=>b.textContent==='Not confirmed').getAttribute('aria-pressed')==='true','Syringe default inferred')`)
 await act(`clickText('U-40')`);await run(`check(document.querySelector('.creation-syringe svg').getAttribute('aria-label').includes('U-40'),'U-40 illustration missing')`)
 await act(`clickText('U-100');document.querySelector('details').open=true`);await act(`fill('Final solution volume','0');document.querySelector('details').open=false`);await act(`clickText('Continue')`);await run(`check(document.querySelector('details').open,'Invalid final volume stayed hidden');checkField('Final solution volume')`);await act(`fill('Final solution volume','2')`);await act(`document.querySelectorAll('input[type=checkbox]').forEach(e=>e.click())`)
 await run(`check(document.body.innerText.includes('0.2 mL ≈ 1 mg'),'Expected synthetic equivalent');check(document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth,'Mobile horizontal overflow')`);await run('checkLayout()');await shot('measurement');await run(`document.querySelector('.quick-review').scrollIntoView({block:'center'})`);{const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'equivalent.png'),Buffer.from(image.data,'base64'))}
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await run(`check([...document.querySelectorAll('.creation-stage-visual *')].every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transitionDuration==='0s'),'Reduced motion not respected')`);await shot('reduced-motion');await send('Emulation.setEmulatedMedia',{features:[]})
 await act(`clickText('Continue')`);await act(`clickText('Daily')`);await run('checkLayout()');await shot('review')
 await act(`clickText('Start tracking')`)
 await run(`check(saved[0].phase.dosing_entry.dose==='','Calculated medication leaked into save');check(saved[0].phase.dosing_entry.final_solution_volume_ml==='2','Final volume lost');check(saved[0].phase.frequency==='daily','Schedule lost');check(saved[0].phase.route===null,'Unspecified route was not null');check(document.body.innerText.includes('Preparing a vial'),'Internal preparation label exposed');check(errors.length===0,JSON.stringify(errors))`)
 await run(`check(saved[0].reconstitution_date==='2026-11-01','Saved date lost');window.savedBefore=JSON.stringify(saved)`)
 for(const surface of ['detail','hero','hero-full']) {await act('showSaved('+JSON.stringify(surface)+')');if(surface==='detail')await act(`document.querySelector('.protocol-more-details').open=true`);await run(`check(document.body.innerText.includes('10 mg'),'Reloaded strength missing');check(document.body.innerText.includes('28-day check reminder'),'Reloaded reminder missing');check(document.body.innerText.includes('Nov 29'),'Reloaded reminder wrong');check(reloaded.vial_strength==='10'&&reloaded.bac_water_ml==='2'&&reloaded.final_solution_volume_ml==='2','Reload changed preparation');check(JSON.stringify(saved)===savedBefore,'Display mutated payload');checkLayout();check(errors.length===0,JSON.stringify(errors))`);await shot(surface)}
 await act(`showSaved('vials')`);await shot('unknown-versus-empty')

 await act(`resetCreation()`);await act(`fill('Amount in the vial','10')`);await act(`fill('Amount in the vial unit','mg')`);await act(`clickText('Ready to use')`)
 await act(`fill('Concentration on the label','5')`);await act(`fill('Concentration on the label unit','mg/mL')`);await act(`clickText('Continue')`)
 await act(`clickText('Medication amount')`);await act(`fill('Your intended amount','1')`);await act(`fill('Medication unit','mg')`);await act(`document.querySelector('details').open=true`)
 await run(`check(!document.querySelector('[aria-label="Final solution volume"]'),'Ready vial amount still requires final volume');check([...document.querySelectorAll('button')].find(b=>b.textContent==='Not confirmed').getAttribute('aria-pressed')==='true','Calibration defaulted')`)
 await act(`clickText('U-100')`);for(let i=0;i<2;i++)await act(`document.querySelectorAll('input[type=checkbox]')[${i}].click()`)
 await run(`check(document.body.innerText.includes('20 markings on U-100'),'Ready-to-use equivalence blocked');check(document.querySelector('[aria-label="Amount in the vial"]').value==='10','Retained amount lost');check(document.querySelector('[aria-label="Concentration on the label"]').value==='5','Label lost')`)
 for(const width of [320,390]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true})
  await act(`document.documentElement.dataset.theme='light'`)
  await run(`var svg=document.querySelector('.creation-syringe svg');check(getComputedStyle(svg.querySelector('.creation-syringe-tick')).stroke==='rgb(37, 75, 99)','Light tick ink missing');check(getComputedStyle(svg.querySelector('text')).fill==='rgb(37, 75, 99)','Light numeral ink missing');check(getComputedStyle(document.querySelector('.creation-syringe figcaption')).color==='rgb(37, 75, 99)','Light caption ink missing');check(document.documentElement.scrollWidth<=innerWidth&&document.querySelector('main').scrollWidth<=innerWidth,'Light layout overflow');check(svg.querySelectorAll('text').length===6,'Calibration labels missing');check(getComputedStyle(svg.querySelector('text')).fontSize==='16px','Light numbers too small')`)
  await shot('ready-light-'+width)
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await act(`document.documentElement.dataset.theme='dark'`)
 await run(`check(getComputedStyle(document.querySelector('.creation-syringe-tick')).stroke==='rgb(193, 231, 237)','Dark ticks changed');check(getComputedStyle(document.querySelector('.creation-syringe-number')).fill==='rgb(230, 244, 246)','Dark numerals changed')`);await shot('ready-dark-390')
 await act(`clickText('Back')`);await act(`clickText('Yes')`);await act(`clickText('Continue')`);await act(`document.querySelector('details').open=true;fill('Final solution volume','1')`)
 for(let i=0;i<2;i++)await act(`var e=document.querySelectorAll('input[type=checkbox]')[${i}];if(!e.checked)e.click()`)
 await run(`check(!document.body.innerText.includes('20 markings on U-100'),'Conflicting active preparation produced precision');check(document.body.innerText.includes('Concentration on the label does not agree'),'Field-specific conflict explanation missing')`)
 await act(`clickText('Back')`);await act(`clickText('Ready to use')`);await act(`clickText('Continue')`);await act(`document.querySelector('details').open=true`)
 for(let i=0;i<2;i++)await act(`var e=document.querySelectorAll('input[type=checkbox]')[${i}];if(!e.checked)e.click()`)
 await run(`check(document.body.innerText.includes('Concentration on the label does not agree'),'Ready conflict bypassed');check(document.querySelector('[aria-label="Final solution volume"]').value==='1','Retained conflicting final volume lost')`)
 await act(`document.querySelector('.creation-preparation-review').open=true`);await run(`document.querySelector('.creation-preparation-review').scrollIntoView({block:'center'})`);{const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'ready-conflict.png'),Buffer.from(image.data,'base64'))}
 await act(`fill('Final solution volume','2')`);for(let i=0;i<2;i++)await act(`var e=document.querySelectorAll('input[type=checkbox]')[${i}];if(!e.checked)e.click()`)
 await run(`check(document.body.innerText.includes('20 markings on U-100'),'Explicit conflict correction did not recover');check(document.querySelector('[aria-label="Amount in the vial"]').value==='10','Amount silently changed');check(document.querySelector('[aria-label="Concentration on the label"]').value==='5','Concentration silently changed');check(errors.length===0,JSON.stringify(errors))`)
 console.log('PASS: 390px three-stage creation, field errors and focus, hidden-error disclosure, unspecified route, explicit calibration, equivalent, canonical payload and reload through Detail/both Heroes, date/reminder, U-40 artwork, reduced motion, keyboard access, no overflow or runtime errors. Ready-to-use reproduction, retained-source conflict recovery, light syringe at 320/390px and dark colors also passed. Evidence: '+evidence)
 await send('Browser.close');ws.close();server.close()
}
const timeout=setTimeout(()=>{console.error('V2A browser timeout');process.exit(1)},90000)
main().then(()=>{clearTimeout(timeout);if(!process.argv.includes('--serve')){ws?.close();server?.close();chrome?.kill()}}).catch(error=>{console.error(error);clearTimeout(timeout);ws?.close();server?.close();chrome?.kill();process.exitCode=1})
