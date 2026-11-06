// Synthetic local preview of real creation components. No services or health data.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http'), cp = require('node:child_process'), ts = require('typescript')
const root = path.resolve(__dirname, '..'), runtime = fs.mkdtempSync(path.join(os.tmpdir(), 'mpp-v2a-'))
const entry = path.join(runtime, 'fixture.tsx'), evidence = path.join(runtime, 'evidence')
fs.mkdirSync(evidence)
fs.writeFileSync(entry, `import React from 'react'; import {createRoot} from 'react-dom/client';
import View from ${JSON.stringify(path.join(root, 'components/protocols/ProtocolQuickStart').replaceAll('\\','/'))};
import {newCompound,protocolCompoundPayload} from ${JSON.stringify(path.join(root, 'lib/protocols/form').replaceAll('\\','/'))};
function Fixture(){const[value,setValue]=React.useState({startDate:'2026-11-05',compounds:[{...newCompound(),name:'Synthetic compound'}]});return <main className="protocols-page protocols-focused"><div className="protocols-container protocols-creation-container"><View value={value} today="2026-11-05" onChange={setValue} onClose={()=>{}} onSave={()=>{window.saved=protocolCompoundPayload(value.compounds)}}/></div></main>};createRoot(document.getElementById('root')).render(<Fixture/>);`)
const modules = [], ids = new Map()
function bundle(file) {
  if (ids.has(file)) return ids.get(file)
  const id=modules.length; ids.set(file,id); modules.push(null)
  let code=fs.readFileSync(file,'utf8')
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
const css=['app/globals.css','app/mobile-app.css','app/protocol/manage/protocols.css'].map(p=>fs.readFileSync(path.join(root,p),'utf8')).join('\n')
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
 const shot=async(name)=>{await run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await sleep(150);const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(evidence,name+'.png'),Buffer.from(s.data,'base64'))}
 await run(`window.checkField=name=>{const e=document.querySelector('[aria-label="'+name+'"]');check(e.getAttribute('aria-invalid')==='true','Field not marked invalid: '+name);check(e.getAttribute('aria-describedby').split(' ').some(id=>document.getElementById(id)?.getAttribute('role')==='alert'),'Missing associated error: '+name);check(document.activeElement===e,'Offending field did not receive focus: '+name)}`)
 await act(`clickText('A vial to mix')`);await act(`fill('Amount in the vial','-1')`);await act(`clickText('Continue')`)
 await run(`check(document.querySelector('h1').textContent==='Preparation','Invalid preparation advanced');checkField('Amount in the vial')`);await shot('preparation-error')
 await act(`fill('Amount in the vial','10');document.querySelector('details').open=true`);await act(`fill('How much liquid did you add?','-1');document.querySelector('details').open=false`);await act(`clickText('Continue')`)
 await run(`check(document.querySelector('details').open,'Invalid liquid stayed hidden');checkField('How much liquid did you add?')`)
 await act(`fill('How much liquid did you add?','');document.querySelector('details').open=false`);await act(`fill('Amount in the vial','10')`);await act(`fill('Amount in the vial unit','mg')`);await shot('preparation')
 await act(`clickText('Continue')`);await run(`check(document.querySelector('[aria-label="How do you take it?"]').value==='','Route was inferred')`);await act(`clickText('Syringe marking')`);await act(`fill('Syringe marking','-1')`);await act(`clickText('Continue')`);await run(`checkField('Syringe marking')`);await act(`fill('Syringe marking','20')`)
 await run(`check([...document.querySelectorAll('button')].find(b=>b.textContent==='Not confirmed').getAttribute('aria-pressed')==='true','Syringe default inferred')`)
 await act(`clickText('U-100');document.querySelector('details').open=true`);await act(`fill('Final solution volume','0');document.querySelector('details').open=false`);await act(`clickText('Continue')`);await run(`check(document.querySelector('details').open,'Invalid final volume stayed hidden');checkField('Final solution volume')`);await act(`fill('Final solution volume','2')`);await act(`document.querySelectorAll('input[type=checkbox]').forEach(e=>e.click())`)
 await run(`check(document.body.innerText.includes('0.2 mL ≈ 1 mg'),'Expected synthetic equivalent');check(document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth,'Mobile horizontal overflow')`);await shot('measurement')
 await act(`clickText('Continue')`);await act(`clickText('Daily')`);await shot('review')
 await act(`clickText('Start tracking')`)
 await run(`check(saved[0].phase.dosing_entry.dose==='','Calculated medication leaked into save');check(saved[0].phase.dosing_entry.final_solution_volume_ml==='2','Final volume lost');check(saved[0].phase.frequency==='daily','Schedule lost');check(saved[0].phase.route===null,'Unspecified route was not null');check(document.body.innerText.includes('Preparing a vial'),'Internal preparation label exposed');check(errors.length===0,JSON.stringify(errors))`)
 console.log('PASS: 390px three-stage creation, field errors and focus, hidden-error disclosure, unspecified route, explicit calibration, equivalent, canonical payload, no overflow or runtime errors. Evidence: '+evidence)
 await send('Browser.close');ws.close();server.close()
}
const timeout=setTimeout(()=>{console.error('V2A browser timeout');process.exit(1)},90000)
main().then(()=>{clearTimeout(timeout);if(!process.argv.includes('--serve')){ws?.close();server?.close();chrome?.kill()}}).catch(error=>{console.error(error);clearTimeout(timeout);ws?.close();server?.close();chrome?.kill();process.exitCode=1})
