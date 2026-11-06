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
function Fixture(){const[value,setValue]=React.useState({startDate:'2026-11-05',compounds:[{...newCompound(),name:${JSON.stringify(process.env.MPP_SETUP_STABILITY==='1'?'':'Synthetic compound')}}]});const[surface,setSurface]=React.useState('creation');window.showSaved=setSurface;window.resetCreation=()=>{setValue({startDate:'2026-11-05',compounds:[{...newCompound(),name:'Synthetic compound'}]});setSurface('creation')};
window.loadHeroCase=(kind,surface)=>{const c={...newCompound(),name:'Synthetic compound',preparation:'mixing',vial_strength:'30',vial_unit:'mg',bac_water_ml:'3',reconstitution_date:'2026-11-01',input_mode:'syringe',syringe_markings:'50',syringe_scale:'100',reviewed:true,days_of_week:[0]};window.saved=protocolCompoundPayload([c]);const phase=window.saved[0].phase;phase.frequency='1x/week';phase.days_of_week=[];phase.day_of_week=null;window.heroLogs=[{compound_id:'compound',taken:true,date:'2026-11-01'}];if(kind==='conflict')phase.dosing_entry.injection_volume='0.6';if(kind==='unsupported')phase.dosing_entry.syringe_scale='50';if(kind==='missing'){window.heroLogs=[];phase.dosing_entry.syringe_scale='';delete phase.dosing_entry.bac_water_ml}if(kind==='daily'){phase.frequency='daily';phase.days_of_week=[0,1,2,3,4,5,6]}setValue({startDate:'2026-11-01',compounds:[c]});setSurface(surface)};
const noop=()=>{};let content;
if(surface==='creation')content=<View value={value} today="2026-11-05" onChange={setValue} onClose={noop} onSave={()=>{window.saved=protocolCompoundPayload(value.compounds)}}/>;
else {const payload=JSON.parse(JSON.stringify(window.saved[0]));const phase={...payload.phase,id:'phase',name:'Phase 1'};delete payload.phase;window.reloaded=entryFormState(phase);const compound={...payload,id:'compound',vial_strength:null,vial_unit:null,bac_water_ml:null,phases:[phase]};const protocol={id:'protocol',name:'Synthetic compound',start_date:value.startDate,status:'active',compounds:[compound]};
content=surface==='detail'?<Detail protocol={protocol} today="2026-11-05" onBack={noop} onEdit={noop} onComplete={noop} onPause={noop} onResume={noop} onReactivate={noop} onDelete={noop} onReload={noop}/>:surface==='vials'?<><h1>Unknown versus empty</h1><Vial name="Unknown remaining" remainingFraction={null} remainingMl={null}/><Vial name="Known empty (synthetic)" remainingFraction={0} remainingMl={0}/></>:<Hero activeProtocols={[protocol]} activeCompoundTab="compound" compoundIndex={0} snapshot={surface==='hero'} logs={{}} allLogs={window.heroLogs||[]} totalLost={null}/>}
if(surface.startsWith('hero'))return <div className={'mobile-app-shell today-surface '+theme.theme}><main className={'today-main '+todayStyles.page}><div className={todayStyles.container}><SectionCard className={todayStyles.activeProtocols}><div className={surface==='hero'?todayStyles.selectedSnapshot:undefined}>{content}</div></SectionCard></div></main></div>;
// Match /protocol/manage: the app shell and setup route do not receive Today's theme reset.
return <div className="mobile-app-shell"><main className="protocols-page protocols-focused"><div className="protocols-container protocols-creation-container"><div className="protocol-editor">{content}</div></div></main></div>};createRoot(document.getElementById('root')).render(<Fixture/>);
`)
const heroOnly=process.argv.includes('--hero-only')||process.env.MPP_HERO_ONLY==='1'
const modules = [], ids = new Map(), extraStyles = []
function bundle(file) {
  if (ids.has(file)) return ids.get(file)
  const id=modules.length; ids.set(file,id); modules.push(null)
  let code=fs.readFileSync(file,'utf8')
  if(file===path.join(root,'lib/supabase.ts')) code="module.exports={createClient:()=>({from:table=>{if(!['protocol_events','injection_logs'].includes(table))throw Error('Unexpected synthetic table');const q={};for(const method of ['select','eq','in','order'])q[method]=()=>q;q.limit=()=>Promise.resolve({data:[],error:null});return q}})}"
  if(heroOnly&&file===path.join(root,'lib/health/useLocalCalendarDate.ts'))code="module.exports={useLocalCalendarDate:()=> '2026-11-05'}"
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
const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>Synthetic V2A preview</title><style>'+css+'body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif}</style><body><div id="root"></div><script>window.errors=[];window.onerror=(...a)=>errors.push(a[0]);window.onunhandledrejection=e=>errors.push(String(e.reason));window.fetch=()=>{throw Error("Network disabled")};window.XMLHttpRequest=()=>{throw Error("Network disabled")};</script><script>'+script.replaceAll('</script','<\\/script')+'</script></body></html>'
fs.writeFileSync(path.join(evidence,'preview.html'),html)
let server,chrome,ws
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
async function main(){
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(process.env.MPP_MOBILE_BASELINE_HTML?fs.readFileSync(process.env.MPP_MOBILE_BASELINE_HTML,'utf8'):html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));
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
 await send('Page.enable');
 // Observe the real mount effect before React runs; never suppress the browser's behavior.
 if(process.env.MPP_SETUP_STABILITY==='1')await send('Page.addScriptToEvaluateOnNewDocument',{source:
  "window.headingScrollCalls=[];const originalFocus=HTMLElement.prototype.focus,originalScroll=Element.prototype.scrollIntoView;HTMLElement.prototype.focus=function(options){if(this.tagName==='H1')headingScrollCalls.push({kind:'focus',preventScroll:options?.preventScroll===true});return originalFocus.call(this,options)};Element.prototype.scrollIntoView=function(options){if(this.tagName==='H1')headingScrollCalls.push({kind:'scrollIntoView'});return originalScroll.call(this,options)};"
 });
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Page.navigate',{url});
 for(let i=0;i<100;i++){if(await run('Boolean(document.querySelector("h1"))'))break;await sleep(100)}
 await run(`window.reveal=e=>{for(let d=e.closest('details');d;d=d.parentElement?.closest('details'))d.open=true};window.clickText=s=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent===s);if(!b)throw Error('Missing button '+s);reveal(b);b.click()};window.fill=(name,value)=>{const e=document.querySelector('[aria-label="'+name+'"]');if(!e)throw Error('Missing field '+name);reveal(e);Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))};window.check=(ok,message)=>{if(!ok)throw Error(message)};`)
 const act=async(code)=>{await run(code);await sleep(80)}
 const shot=async(name)=>{await run('window.scrollTo(0,0);document.querySelector(".protocols-focused")?.scrollTo(0,0)');await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(150);const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(evidence,name+'.png'),Buffer.from(s.data,'base64'))}

 const mobileStage=async(name)=>{
  for(const width of [320,375,390,402])for(const theme of ['dark','light']){
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await act('document.documentElement.dataset.theme='+JSON.stringify(theme));await run(`check(document.documentElement.scrollWidth<=innerWidth&&document.querySelector('main').scrollWidth<=innerWidth,'Stage overflow');for(const e of document.querySelectorAll('input,select,button,summary')){if(!e.checkVisibility())continue;const r=e.getBoundingClientRect();check(r.left>=0&&r.right<=innerWidth,'Stage control clipped')}`);await shot(name+'-'+theme+'-'+width)
  }
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await act(`document.documentElement.dataset.theme='dark'`)
 }
 if(process.env.MPP_SETUP_STABILITY==='1'){
  const results=[];
  for(const width of [320,375,390,402])for(const motion of ['no-preference','reduce']){
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
   await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:motion}]});
   await send('Page.reload');await sleep(250);
   await run("window.geometry=()=>{const m=document.querySelector('main'),h=document.querySelector('h1');return {x:scrollX,mainX:m.scrollLeft,width:innerWidth,documentWidth:document.documentElement.scrollWidth,mainWidth:m.scrollWidth,clientWidth:m.clientWidth,headingLeft:h.getBoundingClientRect().left,containers:[...document.querySelectorAll('.protocols-container,.protocol-editor,.guided-creation,.guided-content,.quick-picker,.quick-segmented,.quick-selected,.quick-amount,.creation-mixing-facts,.creation-mixed-date')].map(e=>({name:e.className,width:e.getBoundingClientRect().width,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,overflowX:getComputedStyle(e).overflowX})),controls:[...document.querySelectorAll('input,select,button,summary')].filter(e=>e.checkVisibility()).map(e=>({name:e.getAttribute('aria-label')||e.textContent,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right}))}};");
   const inspect=async(stage)=>{const g=await run('geometry()');results.push({width,motion,stage,...g});fs.writeFileSync(path.join(evidence,'setup-geometry.json'),JSON.stringify(results,null,2));if(g.x!==0||g.mainX!==0||g.documentWidth>width||g.mainWidth>g.clientWidth||g.containers.some(c=>c.left<-.5||c.right>width+.5||(['auto','scroll','hidden'].includes(c.overflowX)&&c.scrollWidth>c.clientWidth))||g.controls.some(c=>c.left<-.5||c.right>width+.5))throw Error('Setup shifted/clipped: '+JSON.stringify(results.at(-1)))};
   const click=async(text)=>act("[...document.querySelectorAll('button')].find(b=>b.textContent==="+JSON.stringify(text)+").click()");
   const fillField=async(name,value)=>act("(()=>{const e=document.querySelector('[aria-label=\""+name+"\"]');Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,"+JSON.stringify(value)+");e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}))})()");
   await inspect('open');
   {const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(evidence,'opening-'+width+'-'+motion+'.png'),Buffer.from(image.data,'base64'))}
   await run("window.checkValidation=name=>{const e=document.activeElement,r=e.getBoundingClientRect(),m=document.querySelector('main').getBoundingClientRect();if(e.getAttribute('aria-label')!==name||e.getAttribute('aria-invalid')!=='true')throw Error('Invalid control did not receive focus: '+name);if(r.top<m.top||r.bottom>m.bottom)throw Error('Validation control not revealed: '+name)}");
   await run("window.checkHeading=()=>{if(document.activeElement!==document.querySelector('h1'))throw Error('Heading focus lost');if(!headingScrollCalls.length||headingScrollCalls.some(c=>c.kind==='scrollIntoView'||!c.preventScroll))throw Error('Heading delegates scrolling to browser ancestors: '+JSON.stringify(headingScrollCalls));if(document.querySelector('main').scrollTop!==0)throw Error('Step did not reset its own vertical scroll')};checkHeading()");
   await click('Tirzepatide');await inspect('first compound selected');
   await click('Change');await inspect('compound search focused');
   await fillField('Search compounds','Tirzepatide');await click('Tirzepatide');await inspect('compound selected');
   // Use the route CSS, without a fixture sizing reset, for every mixing choice.
   for(const choice of ['No','Ready to use','Not sure','Yes']){
    await click(choice);await inspect('mixing choice '+choice);
    await run("if(Boolean(document.querySelector('.creation-mixing-facts'))!=="+(choice==='Yes')+")throw Error('Unexpected mixing disclosure')");
   }
   await run("window.checkMixedDate=()=>{const e=document.querySelector('[aria-label=\"Reconstitution date\"]'),s=getComputedStyle(e),r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();if(e.type!=='date'||!e.labels?.length||e.disabled||e.readOnly||typeof e.showPicker!=='function'||s.appearance==='none')throw Error('Native accessible date input lost');if(s.paddingLeft!=='0px'||s.paddingRight!=='0px'||s.paddingTop!=='0px'||s.paddingBottom!=='0px'||s.boxSizing!=='border-box'||s.minWidth!=='0px')throw Error('Native date input still has problematic padding/sizing');if(p.width>224.5)throw Error('Mixed date field exceeds compact 224px width: '+p.width);if(e.scrollWidth>e.clientWidth+1)throw Error('Native date contents clipped');if(r.left<p.left||r.right>p.right||r.top<p.top||r.bottom>p.bottom||p.left<0||p.right>innerWidth||p.height<44)throw Error('Mixed date bounds or target size failed')};checkMixedDate()");
   await fillField('Bacteriostatic water added','2');await fillField('Reconstitution date','2026-11-01');await inspect('mixed facts with reminder');
   for(const choice of ['No','Ready to use','Not sure','Yes']){
    await click(choice);await inspect('retained mixing facts '+choice);
    await run("checkMixedDate();if(document.querySelector('[aria-label=\"Reconstitution date\"]').value!=='2026-11-01'||document.querySelector('[aria-label=\"Bacteriostatic water added\"]').value!=='2')throw Error('Switching choices lost preparation facts')");
   }
   await click('Yes');await fillField('Amount in the vial','-1');await click('Continue');await inspect('preparation validation');
   await run("checkValidation('Amount in the vial')");
   await fillField('Amount in the vial','10');await fillField('Amount in the vial unit','mg');await act("document.querySelector('[aria-label=\"Amount in the vial unit\"]').focus()");await inspect('vial unit focused');await fillField('Bacteriostatic water added','2');
   await act("document.querySelector('[aria-label=\"Reconstitution date\"]').focus()");await inspect('date focused');await run('checkMixedDate()');const dateShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(evidence,'mixed-date-'+width+'-'+motion+'.png'),Buffer.from(dateShot.data,'base64'));
   if(width===390&&motion==='no-preference'){
    // A real native picker request in Chromium is still not an iOS picker verification.
    const picker=await send('Runtime.evaluate',{expression:"document.querySelector('[aria-label=\"Reconstitution date\"]').showPicker()",userGesture:true});
    if(picker.exceptionDetails)throw Error('Native date picker failed: '+JSON.stringify(picker.exceptionDetails));
    const capture=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(evidence,'mixed-date-native-picker.png'),Buffer.from(capture.data,'base64'));
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await run("checkMixedDate();if(document.querySelector('[aria-label=\"Reconstitution date\"]').value!=='2026-11-01')throw Error('Picker dismissed value changed')");
   }
   // Desktop emulation cannot open the iOS keyboard: exercise the viewport resize seam explicitly.
   await send('Emulation.setDeviceMetricsOverride',{width,height:400,deviceScaleFactor:1,mobile:true});await sleep(80);await inspect('keyboard-sized viewport');
   await run("if(document.querySelector('main').style.getPropertyValue('--setup-height')!=='400px')throw Error('Viewport height not updated')");
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await sleep(80);
   await click('Continue');await inspect('measurement');await run('checkHeading()');
   await click('Medication amount');await fillField('Your intended amount','-1');await click('Continue');await inspect('measurement validation');await run("checkValidation('Your intended amount')");
   await fillField('Your intended amount','1');await fillField('Medication unit','mg');await click('Continue');await inspect('schedule');
   await click('Back');await inspect('back to measurement');await click('Back');await inspect('back to preparation');await run('checkHeading()');
   await act("document.querySelector('main').scrollTop=200");await run("if(document.querySelector('main').scrollTop<=0)throw Error('Intentional vertical scrolling blocked')");await inspect('intentional vertical scroll');
   const image=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(evidence,'setup-'+width+'-'+motion+'.png'),Buffer.from(image.data,'base64'));
   await run("if(errors.length)throw Error(JSON.stringify(errors))");
  }
  console.log('PASS: setup stability at 320/375/390/402px, normal/reduced motion, compound selection, input/date focus, keyboard-sized resize, validation and step/back navigation. Evidence: '+evidence);
  await send('Browser.close');ws.close();server.close();return;
 }
 if(heroOnly){
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const width of [320,375,390,402])for(const theme of ['dark','light'])for(const surface of ['hero','hero-full']){
   await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await act('document.documentElement.dataset.theme='+JSON.stringify(theme)+';loadHeroCase("screenshot",'+JSON.stringify(surface)+')');
   await run(`{window.heroBefore=JSON.stringify(saved);check(document.documentElement.scrollWidth<=innerWidth,'Hero horizontal overflow');const section=document.querySelector('main section'),svg=document.querySelector('[data-premium-vial]'),heading=document.querySelector('h2,h3');const box=section.getBoundingClientRect(),art=svg.getBoundingClientRect();check(Math.abs((box.left+box.right-art.left-art.right)/2)<2,'Vial not centered');check(getComputedStyle(heading).textAlign==='center','Heading not centered');check(section.offsetHeight<800,'Excessive Hero height');check(!document.querySelector('[data-vial-liquid]'),'Unknown remaining shown as liquid');check(document.querySelector('[data-vial-interior=untracked]')&&!svg.textContent.includes('?'),'Unknown artwork lost distinction or kept question mark');check(document.querySelector('dl').children.length===6,'Expected six primary facts');check(getComputedStyle(document.querySelector('dl')).gridTemplateColumns.split(' ').length===2,'Expected two fact columns');const visible=document.body.innerText;for(const fact of ['30 mg','Nov 1, 2026','Nov 29, 2026','50 units','U-100','BAC water added','3 mL','28-day vial check','Syringe volume','0.5 mL','1 logged','Schedule not set'])check(visible.includes(fact),'Missing visible fact: '+fact);const volume=[...document.querySelectorAll('dl dt')].find(e=>e.textContent==='Syringe volume').nextElementSibling;check(volume.textContent==='0.5 mL'&&volume.children.length===0,'Volume provenance sublabel remains');check(!visible.includes('Remaining not tracked'),'Remaining label remains in Hero');check(document.querySelector('[data-inventory-state=unknown]'),'Unknown state changed');check(!visible.includes('Vial expiration')&&!visible.includes('More protocol details')&&!visible.includes('Vials in stock'),'Redundant/unknown rows visible');check([...document.querySelectorAll('dl dt,dl dd')].every(e=>e.checkVisibility()&&!e.closest('details')),'Primary facts hidden');for(const e of document.querySelectorAll('button,a,summary,dt,dd')){if(!e.checkVisibility())continue;const r=e.getBoundingClientRect();check(r.left>=0&&r.right<=innerWidth,'Hero content clipped')}check([...svg.querySelectorAll('*')].every(e=>getComputedStyle(e).animationName==='none'),'Reduced motion failed')}`);await shot('final-'+surface+'-'+theme+'-'+width);
   await act(`document.querySelector('[data-vial-remaining-reason]').open=true`);await run(`check(document.body.innerText.includes('not an expiration or safe-use date'),'Check explanation missing')`);await act(`document.querySelector('[data-vial-remaining-reason]').open=false;clickText('+ New Vial')`);await run(`check(document.querySelector('dialog[open]').innerText.includes('temporarily unavailable'),'New Vial restriction lost')`);await act(`clickText('Close')`);await run(`check(JSON.stringify(saved)===heroBefore,'Hero mutated saved facts')`);
  }
  for(const surface of ['hero','hero-full'])for(const kind of ['conflict','unsupported','missing','daily']){
   await act('loadHeroCase('+JSON.stringify(kind)+','+JSON.stringify(surface)+')');
   await run(`{const visible=document.body.innerText;if(`+JSON.stringify(kind)+`==='daily')check(visible.includes('Nov 5, 2026'),'Complete schedule has no date');else check(!visible.includes('Syringe volume'),'Invalid or conflicting facts yielded volume');if(`+JSON.stringify(kind)+`==='conflict')check(visible.includes('saved volume and syringe markings disagree')&&document.querySelector('a[href*="/protocol/manage?compound=compound"]'),'Conflict not recoverable');if(`+JSON.stringify(kind)+`==='missing')check(visible.includes('Not established')&&!visible.includes('0 recorded')&&!visible.includes('BAC water added'),'Unknown count became zero');check(errors.length===0,JSON.stringify(errors))}`);await shot(kind+'-'+surface)
  }
  console.log('PASS: final Hero facts, both variants at 320/375/390/402 light/dark; centered visible facts, no overflow/clipping, reduced motion, New Vial restriction, immutable payload, conflict/unsupported/missing recovery, logged counts and calendar schedule. Evidence: '+evidence);await send('Browser.close');ws.close();server.close();return
 }
 if(process.argv.includes('--capture-primary')){
  await act(`clickText('Yes')`);await act(`fill('Amount in the vial','10')`);await act(`fill('Amount in the vial unit','mg')`);await act(`clickText('Continue')`)
  for(const width of [320,375,390,402])for(const theme of ['dark','light']){await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await act('document.documentElement.dataset.theme='+JSON.stringify(theme)+';document.querySelectorAll("details").forEach(d=>d.open=false)');await shot('onboarding-'+theme+'-'+width)}
  console.log('Primary-path screenshots: '+evidence);await send('Browser.close');ws.close();server.close();return
 }
 await run(`window.checkField=name=>{const e=document.querySelector('[aria-label="'+name+'"]');check(e.getAttribute('aria-invalid')==='true','Field not marked invalid: '+name);check(e.getAttribute('aria-describedby').split(' ').some(id=>document.getElementById(id)?.getAttribute('role')==='alert'),'Missing associated error: '+name);check(document.activeElement===e,'Offending field did not receive focus: '+name)}`)
 await run(`window.checkLayout=()=>{const main=document.querySelector('main');check(document.documentElement.scrollWidth<=390&&main.scrollWidth<=main.clientWidth,'Horizontal overflow');const art=document.querySelector('.creation-stage-visual');if(art){check(art.offsetHeight<=220,'Artwork adds excessive scroll');const children=[...art.children].map(e=>e.getBoundingClientRect());check(children[0].right<=children[1].left,'Artwork overlaps text')}for(const e of document.querySelectorAll('input,select,button,summary')){if(!e.checkVisibility())continue;const r=e.getBoundingClientRect();check(r.left>=0&&r.right<=391,'Control exceeds viewport')}};checkLayout()`)
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await run(`check(document.activeElement.tagName==='BUTTON','Keyboard cannot reach first control')`)
 await shot('compound-selection')
 await act(`clickText('Yes')`);await act(`fill('Amount in the vial','-1')`);await act(`clickText('Continue')`)
 await run(`check(document.querySelector('h1').textContent==='Preparation','Invalid preparation advanced');checkField('Amount in the vial')`);await shot('preparation-error')
 await act(`fill('Amount in the vial','10')`);await act(`fill('Bacteriostatic water added','-1')`);await act(`clickText('Continue')`)
 await run(`checkField('Bacteriostatic water added')`)
 await act(`fill('Bacteriostatic water added','2')`);await act(`fill('Amount in the vial','10')`);await act(`fill('Amount in the vial unit','mg')`);await act(`fill('Reconstitution date','2026-11-01')`);await run(`check(document.body.innerText.includes('28-day check reminder: Nov 29'),'Reminder missing');checkLayout()`);await shot('preparation');await mobileStage('preparation')
 await act(`clickText('Continue')`);await run(`check(document.querySelector('[aria-label="How do you take it?"]').value==='','Route was inferred')`);for(const width of [320,375,390,402])for(const theme of ['dark','light']){
 await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await act('document.documentElement.dataset.theme='+JSON.stringify(theme)+';document.querySelectorAll("details").forEach(d=>d.open=false)');await run(`check(!document.querySelector('.creation-equivalent').open,'Equivalent initially expanded');check([...document.querySelectorAll('.creation-equivalent input,.creation-equivalent select,.creation-equivalent button')].every(e=>!e.checkVisibility()),'Equivalent controls visible without request');check(document.querySelector('[aria-label="Your intended amount"]').getClientRects().length>0,'Primary amount hidden');check(document.documentElement.scrollWidth<=innerWidth&&document.querySelector('main').scrollWidth<=innerWidth,'Onboarding overflow');for(const e of document.querySelectorAll('input,select,button,summary')){if(!e.checkVisibility())continue;const r=e.getBoundingClientRect();check(r.left>=0&&r.right<=innerWidth,'Onboarding control clipped')}`);await shot('onboarding-'+theme+'-'+width)
 }
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await act(`document.documentElement.dataset.theme='dark'`);await act(`clickText('Syringe marking')`);await act(`fill('Syringe marking','-1')`);await act(`clickText('Continue')`);await run(`checkField('Syringe marking')`);await act(`fill('Syringe marking','20')`)
 await run(`check([...document.querySelectorAll('button')].find(b=>b.textContent==='Not confirmed').getAttribute('aria-pressed')==='true','Syringe default inferred')`)
 await act(`clickText('U-40')`);await run(`check(document.querySelector('.creation-syringe svg').getAttribute('aria-label').includes('U-40'),'U-40 illustration missing')`)
 await act(`clickText('U-100');document.querySelector('.creation-equivalent').open=true`);await act(`fill('Final solution volume','0');document.querySelector('.creation-equivalent').open=false`);await act(`clickText('Continue')`);await run(`check(document.querySelector('.creation-equivalent').open,'Invalid final volume stayed hidden');checkField('Final solution volume')`);await act(`fill('Final solution volume','2')`);await act(`document.querySelectorAll('input[type=checkbox]').forEach(e=>e.click())`)
 await run(`check(document.body.innerText.includes('0.2 mL ≈ 1 mg'),'Expected synthetic equivalent');check(document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth,'Mobile horizontal overflow')`);await run('checkLayout()');await shot('measurement');await run(`document.querySelector('.quick-review').scrollIntoView({block:'center'})`);{const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'equivalent.png'),Buffer.from(image.data,'base64'))}
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});await run(`check([...document.querySelectorAll('.creation-stage-visual *')].every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).transitionDuration==='0s'),'Reduced motion not respected')`);await shot('reduced-motion');await send('Emulation.setEmulatedMedia',{features:[]})
 await act(`clickText('Continue')`);await act(`clickText('Daily')`);await run(`checkLayout();check([...document.querySelectorAll('details')].every(d=>!d.open),'Advanced review fields initially expanded');check([...document.querySelectorAll('details input,details select')].every(e=>!e.checkVisibility()),'Advanced review input visible')`);await shot('review');await mobileStage('review')
 await act(`clickText('Start tracking')`)
 await run(`check(saved[0].phase.dosing_entry.dose==='','Calculated medication leaked into save');check(saved[0].phase.dosing_entry.final_solution_volume_ml==='2','Final volume lost');check(saved[0].phase.frequency==='daily','Schedule lost');check(saved[0].phase.route===null,'Unspecified route was not null');check(document.body.textContent.includes('Preparing a vial'),'Internal preparation label exposed');check(errors.length===0,JSON.stringify(errors))`)
 await run(`check(saved[0].reconstitution_date==='2026-11-01','Saved date lost');window.savedBefore=JSON.stringify(saved)`)
 for(const surface of ['detail','hero','hero-full']) {await act('showSaved('+JSON.stringify(surface)+')');if(surface==='detail')await act(`document.querySelector('.protocol-more-details').open=true`);await run(`check(document.body.innerText.includes('10 mg'),'Reloaded strength missing');check((document.body.innerText.includes('28-day check')||document.body.innerText.includes('28-day vial check')),'Reloaded reminder missing');check(document.body.innerText.includes('Nov 29'),'Reloaded reminder wrong');check(reloaded.vial_strength==='10'&&reloaded.bac_water_ml==='2'&&reloaded.final_solution_volume_ml==='2','Reload changed preparation');check(JSON.stringify(saved)===savedBefore,'Display mutated payload');checkLayout();check(errors.length===0,JSON.stringify(errors))`);await shot(surface)}

 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const mobileResults=[]
 for(const width of [320,375,390,402])for(const theme of ['dark','light']){
  await send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});await act('document.documentElement.dataset.theme='+JSON.stringify(theme)+';showSaved("hero")');await shot('hero-'+theme+'-'+width)
  const geometry=await run(`(()=>{const card=document.querySelector('.today-protocol-snapshot'),h=card.querySelector('.today-snapshot-heading').getBoundingClientRect(),v=card.querySelector('.today-snapshot-vial-rail').getBoundingClientRect();return {width:innerWidth,height:card.getBoundingClientRect().height,headingBottom:h.bottom,vialTop:v.top,overflow:document.documentElement.scrollWidth>innerWidth}})()`);mobileResults.push({theme,...geometry})
  if(!process.argv.includes('--mobile-baseline'))await run(`check(document.querySelector('.today-snapshot-vial-rail').getBoundingClientRect().top>=document.querySelector('.today-snapshot-heading').getBoundingClientRect().bottom,'Mobile Hero still uses compressed columns');check(document.querySelector('.today-protocol-snapshot').getBoundingClientRect().height<650,'Mobile Hero too tall');check(document.documentElement.scrollWidth<=innerWidth,'Mobile Hero overflow')`)

  if(!process.argv.includes('--mobile-baseline')){
   await run(`check(!document.querySelector('[data-vial-remaining-reason]').open,'Secondary facts initially expanded');check(document.querySelector('[data-premium-vial]').getBoundingClientRect().width>=110,'Vial too small');check(!document.querySelector('[data-vial-liquid]'),'Unknown remaining got a fill');check([...document.querySelectorAll('[data-premium-vial] *')].every(e=>getComputedStyle(e).animationName==='none'),'Hero reduced motion lost');check(document.body.innerText.includes('10 mg')&&document.body.innerText.includes('Nov 1'),'Essential recorded facts missing');for(const e of document.querySelectorAll('button,a,summary')){if(!e.checkVisibility())continue;const r=e.getBoundingClientRect();check(r.left>=0&&r.right<=innerWidth,'Mobile control clipped')};check(document.querySelector('a[href="/protocol/manage?compound=compound"]'),'Manage navigation lost');check(document.querySelector('a[href="/protocol/inventory"]'),'Inventory navigation lost')`)
   await act(`clickText('+ New Vial')`);await run(`check(document.querySelector('dialog[open]'),'New Vial explanation unavailable');check(document.querySelector('dialog').innerText.includes('temporarily unavailable'),'New Vial safety restriction lost')`);await act(`clickText('Close')`)
   await act(`document.querySelector('[data-vial-remaining-reason]').open=true`);await run(`check(document.querySelector('[data-vial-remaining-reason]').innerText.includes('not an expiration'),'Reminder explanation unavailable')`);await act(`document.querySelector('[data-vial-remaining-reason]').open=false;document.querySelector('[data-vial-remaining-reason]').open=true`);await run(`check(document.querySelector('[data-vial-remaining-reason]').innerText.includes('current physical vial'),'Preparation explanation unavailable')`);await act(`document.querySelector('[data-vial-remaining-reason]').open=false;showSaved('hero-full')`);await run(`check(document.documentElement.scrollWidth<=innerWidth,'Full Hero overflow');check(document.querySelector('main section').getBoundingClientRect().height<750,'Full Hero too tall')`);await shot('full-hero-'+theme+'-'+width)
  }
 }
 fs.writeFileSync(path.join(evidence,'mobile-geometry.json'),JSON.stringify(mobileResults,null,2))
 if(!process.argv.includes('--mobile-baseline')){
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});await act(`showSaved('hero')`);await run(`check(getComputedStyle(document.querySelector('.today-protocol-snapshot')).gridTemplateColumns.split(' ').length===1,'Centered Hero columns changed');check(document.querySelector('.today-protocol-snapshot > .today-snapshot-facts').checkVisibility(),'Desktop facts hidden');check(!document.querySelector('[data-vial-remaining-reason]').open,'Secondary details initially expanded');check(document.documentElement.scrollWidth<=innerWidth,'Desktop overflow')`);await shot('desktop-hero');
 }

 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await act(`document.documentElement.dataset.theme='dark'`)
 await act(`showSaved('vials')`);await shot('unknown-versus-empty')

 await act(`resetCreation()`);await act(`fill('Amount in the vial','10')`);await act(`fill('Amount in the vial unit','mg')`);await act(`clickText('Ready to use')`)
 await act(`clickText('Continue')`);await act(`fill('Concentration on the label','5')`);await act(`fill('Concentration on the label unit','mg/mL')`)
 await act(`clickText('Medication amount')`);await act(`fill('Your intended amount','1')`);await act(`fill('Medication unit','mg')`);await act(`document.querySelector('.creation-equivalent').open=true`)
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
 await act(`clickText('Back')`);await act(`clickText('Yes')`);await act(`clickText('Continue')`);await act(`document.querySelector('.creation-equivalent').open=true;fill('Final solution volume','1')`)
 for(let i=0;i<2;i++)await act(`var e=document.querySelectorAll('input[type=checkbox]')[${i}];if(!e.checked)e.click()`)
 await run(`check(!document.body.innerText.includes('20 markings on U-100'),'Conflicting active preparation produced precision');check(document.body.innerText.includes('Concentration on the label does not agree'),'Field-specific conflict explanation missing')`)
 await act(`clickText('Back')`);await act(`clickText('Ready to use')`);await act(`clickText('Continue')`);await act(`document.querySelector('.creation-equivalent').open=true`)
 for(let i=0;i<2;i++)await act(`var e=document.querySelectorAll('input[type=checkbox]')[${i}];if(!e.checked)e.click()`)
 await run(`check(document.body.innerText.includes('Concentration on the label does not agree'),'Ready conflict bypassed');check(document.querySelector('[aria-label="Final solution volume"]').value==='1','Retained conflicting final volume lost')`)
 await act(`document.querySelector('.creation-preparation-review').open=true`);await run(`document.querySelector('.creation-preparation-review').scrollIntoView({block:'center'})`);{const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'ready-conflict.png'),Buffer.from(image.data,'base64'))}
 await act(`fill('Final solution volume','2')`);for(let i=0;i<2;i++)await act(`var e=document.querySelectorAll('input[type=checkbox]')[${i}];if(!e.checked)e.click()`)
 await run(`check(document.body.innerText.includes('20 markings on U-100'),'Explicit conflict correction did not recover');check(document.querySelector('[aria-label="Amount in the vial"]').value==='10','Amount silently changed');check(document.querySelector('[aria-label="Concentration on the label"]').value==='5','Concentration silently changed');check(errors.length===0,JSON.stringify(errors))`)
 console.log('PASS: 320/375/390/402px mobile Hero and onboarding, both themes, compact geometry, disclosures, New Vial restriction, navigation, responsive desktop layout; 390px three-stage creation, field errors and focus, hidden-error disclosure, unspecified route, explicit calibration, equivalent, canonical payload and reload through Detail/both Heroes, date/reminder, U-40 artwork, reduced motion, keyboard access, no overflow or runtime errors. Ready-to-use reproduction, retained-source conflict recovery, light syringe at 320/390px and dark colors also passed. Evidence: '+evidence)
 await send('Browser.close');ws.close();server.close()
}
const timeout=setTimeout(()=>{console.error('V2A browser timeout');process.exit(1)},90000)
main().then(()=>{clearTimeout(timeout);if(!process.argv.includes('--serve')){ws?.close();server?.close();chrome?.kill()}}).catch(error=>{console.error(error);clearTimeout(timeout);ws?.close();server?.close();chrome?.kill();process.exitCode=1})
