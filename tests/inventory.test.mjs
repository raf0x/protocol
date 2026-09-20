import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const code = ts.transpileModule(readFileSync(url,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const result = {exports:{}}
  const resolve = name => name.endsWith('.css') ? {} : name.startsWith('.') ? load(new URL(name + (existsSync(new URL(name+'.tsx',url)) ? '.tsx' : '.ts'),url).href) : require(name)
  new Function('require','module','exports',code)(resolve,result,result.exports)
  cache.set(url.href,result.exports); return result.exports
}
const model = load('../lib/inventory/model.ts')
const {readInventoryWorkbook} = load('../lib/inventory/workbook.ts')
const {INVENTORY_HEADERS: headers, previewInventory, importableRows} = model
const valid = {item_name:'Test item',form:'lyophilized vial',vial_strength:10,strength_unit:'mg',quantity:2,acquisition_date:'2026-09-01',expiration_date:'2027-09-01',reconstitution_status:'not reconstituted'}
const preview = (rows,existing=[]) => previewInventory(rows.map((values,i)=>({rowNumber:i+7,values})),existing,'2026-09-21')
const escape = s => String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
function fixture(rows=[valid], mutate=()=>{}) {
  const cell = (v,c,r) => `<c r="${String.fromCharCode(65+c)}${r}" t="inlineStr"><is><t>${escape(v??'')}</t></is></c>`
  const row = (values,r) => `<row r="${r}">${values.map((v,c)=>cell(v,c,r)).join('')}</row>`
  const files = {
    '[Content_Types].xml':'<Types/>',
    'xl/workbook.xml':'<workbook xmlns:r="r"><sheets><sheet name="Inventory" r:id="r1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':`<worksheet><sheetData>${row(headers,5)}${rows.map((v,i)=>row(headers.map(h=>v[h]),i+6)).join('')}</sheetData></worksheet>`,
  }
  mutate(files)
  return zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])))
}
test('downloadable real template: one named sheet, stable headers, dropdowns, excluded example and no formulas/macros', () => {
  const bytes = readFileSync(new URL('../public'+model.TEMPLATE_URL,import.meta.url))
  const rows = readInventoryWorkbook(bytes,'template.xlsx')
  const p = previewInventory(rows,[],'2026-09-21')
  assert.equal(p.examples,1); assert.deepEqual(p.rows,[])
  const files = unzipSync(bytes), xml = Object.entries(files).filter(([name])=>name.endsWith('.xml')).map(([,v])=>strFromU8(v)).join('')
  for (const h of headers) assert.ok(xml.includes(h),h)
  assert.match(xml,/dataValidation/); assert.match(xml,/lyophilized vial/); assert.match(xml,/mcg/)
  assert.doesNotMatch(xml,/<(?:\w+:)?f[ >]/); assert.ok(!Object.keys(files).some(n=>/vba|\.bin$/i.test(n)))
})
test('values-only workbook parser handles escaped text, numeric Excel dates, reordered columns and formula rejection', () => {
  assert.equal(readInventoryWorkbook(fixture([{...valid,item_name:'A & B < C'}]),'items.xlsx')[0].values.item_name,'A & B < C')
  const date = fixture([valid],f=>{f['xl/worksheets/sheet1.xml']=f['xl/worksheets/sheet1.xml'].replace(/<c r="G6".*?<\/c>/,'<c r="G6"><v>46266</v></c>')})
  assert.equal(readInventoryWorkbook(date,'items.xlsx')[0].values.acquisition_date,'2026-09-01')
  const formulas = fixture([valid],f=>{f['xl/worksheets/sheet1.xml']=f['xl/worksheets/sheet1.xml'].replace(/<c r="F6".*?<\/c>/,'<c r="F6"><f>1+1</f><v>2</v></c>')})
  const p = previewInventory(readInventoryWorkbook(formulas,'items.xlsx'),[],'2026-09-21')
  assert.match(p.rows[0].errors.join(),/F6: formulas/); assert.equal(importableRows(p).length,0)
  const reordered = fixture([valid],f=>{f['xl/worksheets/sheet1.xml']=f['xl/worksheets/sheet1.xml'].replaceAll('item_name','TEMP').replaceAll('form','item_name').replaceAll('TEMP','form').replace('Test item','TEMP').replace('lyophilized vial','Test item').replace('TEMP','lyophilized vial')})
  assert.equal(readInventoryWorkbook(reordered,'items.xlsx')[0].values.item_name,'Test item')
})
test('rejects wrong extension, missing headers, extra sheets, macros, external content, oversized files and expansion', () => {
  assert.throws(()=>readInventoryWorkbook(fixture(),'x.csv'),/xlsx/)
  assert.throws(()=>readInventoryWorkbook(new Uint8Array(2_000_001),'x.xlsx'),/2 MB/)
  assert.throws(()=>readInventoryWorkbook(fixture([],f=>{f['xl/worksheets/sheet1.xml']=f['xl/worksheets/sheet1.xml'].replace('quantity','missing')}),'x.xlsx'),/headers/)
  assert.throws(()=>readInventoryWorkbook(fixture([],f=>{f['xl/workbook.xml']=f['xl/workbook.xml'].replace('</sheets>','<sheet name="Other"/></sheets>')}),'x.xlsx'),/one worksheet/)
  for(const name of ['xl/vbaProject.bin','xl/externalLinks/externalLink1.xml']) assert.throws(()=>readInventoryWorkbook(fixture([],f=>{f[name]='bad'}),'x.xlsx'),/macros\/external/)
  assert.throws(()=>readInventoryWorkbook(fixture([],f=>{f['big.xml']=' '.repeat(4_000_001)}),'x.xlsx'),/too large/)
  assert.throws(()=>preview(Array.from({length:501},(_,i)=>({...valid,item_name:String(i)}))),/500/)
  assert.equal(importableRows(preview(Array.from({length:500},(_,i)=>({...valid,item_name:String(i)})))).length,500)
})
test('validates required fields, date ordering, reconstitution, quantity, enums and medication-strength semantics', () => {
  const cases = [
    [{item_name:''},/item_name/], [{quantity:''},/quantity/], [{quantity:0},/quantity/], [{quantity:1.2},/quantity/], [{quantity:-1},/quantity/],
    [{acquisition_date:'2026-02-30'},/real date/], [{expiration_date:'2026-08-01'},/before acquisition/],
    [{reconstitution_status:'reconstituted'},/required/], [{reconstitution_date:'2026-09-02'},/Set reconstitution_status/],
    [{reconstitution_status:'reconstituted',reconstitution_date:'2026-08-01'},/before acquisition/],
    [{form:'tablet'},/form must/], [{strength_unit:'mL'},/Syringe units/], [{strength_unit:'units'},/Syringe units/],
    [{vial_strength:''},/both/], [{vial_strength:-10},/positive/], [{reconstitution_status:'yes'},/status must/],
  ]
  for(const [patch,error] of cases) assert.match(preview([{...valid,...patch}]).rows[0].errors.join(),error,JSON.stringify(patch))
  const p = preview([{...valid,form:'',reconstitution_status:'',expiration_date:'2026-09-02'}])
  assert.equal(p.rows[0].warnings.length,3); assert.equal(importableRows(p).length,1)
  assert.equal(preview([{...valid,row_type:'EXAMPLE',quantity:-1}]).rows.length,0)
})
test('duplicates require all normalized fields; never merge names, cases, lots or quantities', () => {
  const saved = importableRows(preview([valid]))
  const p = preview([{...valid,item_name:' Test item '}, {...valid,quantity:3},{...valid,item_name:'test item'},{...valid,lot_number:'new'},valid],saved)
  assert.deepEqual(p.rows.map(r=>r.duplicate),[true,false,false,false,true])
  assert.deepEqual(preview([valid,valid]).rows.map(r=>r.duplicate),[false,true])
})
test('client requires confirmation, filters invalid/duplicate rows, keeps retry ID and scopes reads/deletes to owner', async () => {
  const client = load('../lib/inventory/client.ts'), calls=[]
  const mock = {rpc:async(name,args)=>{calls.push({name,args});return {data:{inserted:1,duplicates:0}}}}
  const p = preview([valid,valid,{...valid,quantity:0}])
  await assert.rejects(client.confirmInventoryImport(p,'request',false,mock),/confirm/); assert.equal(calls.length,0)
  await client.confirmInventoryImport(p,'request',true,mock); await client.confirmInventoryImport(p,'request',true,mock)
  assert.deepEqual(calls[0],calls[1]); assert.equal(calls[0].name,'import_inventory_v1'); assert.equal(calls[0].args.p_rows.length,1)
  const queries=[]; const query={select(){return this},delete(){return this},eq(k,v){queries.push([k,v]);return this},order(){return this},range:async()=>({data:[]}),then(resolve){resolve({data:[{id:'item'}]})}}
  const owned={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from(name){assert.equal(name,'inventory_items');return query}}
  await client.loadInventory(owned); await client.deleteInventoryItem('item',owned)
  assert.deepEqual(queries,[['user_id','owner'],['id','item'],['user_id','owner']])
})
test('Today exposes the independent Inventory route', () => {
  const Header=load('../components/today/TodayHeader.tsx').default
  assert.match(renderToStaticMarkup(React.createElement(Header,{date:'2026-09-21'})),/href="\/protocol\/inventory"/)
})

function renderPreview(review) {
  let slot=0
  const component={exports:{}}
  const code=ts.transpileModule(readFileSync(new URL('../components/inventory/Inventory.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(name==='react') return {...React,useEffect(){},useState(initial){return [slot++===5?review:initial,()=>{}]},useRef(initial){return {current:initial}}}
    if(name.endsWith('/model')) return model
    if(name.endsWith('/client')||name.endsWith('.css')) return {}
    if(name.includes('ProtocolDialog')) return {__esModule:true,default:({children})=>children}
    return require(name)
  },component,component.exports)
  return renderToStaticMarkup(React.createElement(component.exports.default))
}

for (const count of [0,1,2]) test(`preview counts use correct wording for ${count} rows`,()=>{
  const rows=[]
  for(let i=0;i<count;i++) rows.push(
    {...valid,item_name:`warning ${i}`,form:''},
    {...valid,item_name:`duplicate ${i}`},
    {...valid,item_name:`invalid ${i}`,quantity:0},
    {...valid,row_type:'EXAMPLE'},
  )
  const existing=importableRows(preview(Array.from({length:count},(_,i)=>({...valid,item_name:`duplicate ${i}`}))))
  const html=renderPreview(preview(rows,existing)),suffix=count===1?'':'s'
  for(const label of [`valid new row${suffix}`,`row${suffix} with warnings`,`duplicate${suffix}`,`invalid row${suffix}`]) assert.ok(html.includes(`<li>${count} ${label}</li>`),label)
  assert.ok(html.includes(`${count} example row${suffix} excluded.`))
  assert.ok(html.includes(`Import ${count} valid new record${suffix} only.`))
})

test('each Review cell shows its warning status and every warning, while clean rows remain Valid',()=>{
  const review=preview([{...valid,item_name:'One warning',form:''},{...valid,item_name:'Multiple warnings',form:'',reconstitution_status:'',expiration_date:'2026-09-02'},valid])
  const html=renderPreview(review)
  const cells=[...html.matchAll(/<td data-label="Review">(.*?)<\/td>/g)].map(match=>match[1])
  assert.equal(cells.length,3)
  assert.match(cells[0],/<strong>Valid with warning<\/strong>/)
  assert.match(cells[1],/<strong>Valid with warnings<\/strong>/)
  for(let i=0;i<2;i++) {
    assert.doesNotMatch(cells[i],/<strong>Valid<\/strong>/)
    assert.equal([...cells[i].matchAll(/<li>/g)].length,review.rows[i].warnings.length)
    for(const warning of review.rows[i].warnings) assert.ok(cells[i].includes(`<li>${warning}</li>`),warning)
  }
  assert.match(cells[2],/<strong>Valid<\/strong>/)
  assert.equal(importableRows(review).length,3,'warnings must not change import eligibility')
})

test('actual inventory UI previews before confirmation, serializes double clicks and confirms deletion', async () => {
  const states=[],refs=[]; let slot=0,refSlot=0,importCalls=0,deleted=0,release
  const saved={...importableRows(preview([valid]))[0],id:'record',user_id:'owner',created_at:'today'}
  const component={exports:{}}
  const code=ts.transpileModule(readFileSync(new URL('../components/inventory/Inventory.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(name==='react') return {...React,useEffect(){},useState(initial){const i=slot++;if(!(i in states)) states[i]=initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}]},useRef(initial){return refs[refSlot++]??(refs[refSlot-1]={current:initial})}}
    if(name.endsWith('/model')) return model
    if(name.endsWith('/client')) return {loadInventory:async()=>importCalls?[saved]:[],confirmInventoryImport:async()=>{importCalls++;await new Promise(r=>{release=r});return {inserted:1,duplicates:0}},deleteInventoryItem:async()=>{deleted++}}
    if(name.endsWith('.css')) return {}
    if(name.includes('ProtocolDialog')) return {__esModule:true,default:({children})=>children}
    return require(name)
  },component,component.exports)
  const render=()=>{slot=0;refSlot=0;return component.exports.default()}
  const nodes=(node)=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)]
  const find=(tree,predicate)=>nodes(tree).find(predicate)
  for(const [field,value] of Object.entries(valid)) {
    const tree=render(), label=find(tree,n=>n.type==='label'&&n.key===field)
    const input=find(label,n=>['input','select','textarea'].includes(n.type))
    input.props.onChange({target:{value:String(value)}})
  }
  await find(render(),n=>n.type==='form').props.onSubmit({preventDefault(){}})
  assert.equal(importCalls,0)
  let tree=render(),confirm=find(tree,n=>n.type==='button'&&n.props.children==='Confirm import')
  assert.equal(confirm.props.disabled,true); await confirm.props.onClick(); assert.equal(importCalls,0)
  find(tree,n=>n.type==='input'&&n.props.type==='checkbox').props.onChange({target:{checked:true}})
  confirm=find(render(),n=>n.type==='button'&&n.props.children==='Confirm import'); assert.equal(confirm.props.disabled,false)
  const saving=confirm.props.onClick(); await confirm.props.onClick(); assert.equal(importCalls,1); release(); await saving
  tree=render(); assert.equal(find(tree,n=>n.type==='button'&&n.props.children==='Confirm import'),undefined)
  find(tree,n=>n.type==='button'&&Array.isArray(n.props.children)&&n.props.children[0]==='Delete ').props.onClick()
  assert.equal(deleted,0); await find(render(),n=>n.type==='button'&&n.props.children==='Delete record').props.onClick(); assert.equal(deleted,1)
})
