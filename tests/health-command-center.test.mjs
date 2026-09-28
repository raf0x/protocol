import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path, overrides = {}) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (!Object.keys(overrides).length && cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in overrides) return overrides[name]
    if (name === 'server-only') return {}
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href, overrides) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  if (!Object.keys(overrides).length) cache.set(url.href, out.exports)
  return out.exports
}

const { commandCenterModel, healthDate, shiftHealthDate, calendarTime, mondayForHealthDate } = load('../lib/health/commandCenter.ts')
const { normalizeTimeline } = load('../lib/health/timeline.ts')
const { parseTreatmentIdentityKey } = load('../lib/health/protocolIdentity.ts')
const row = (date, extra = {}) => ({ id: date, date, notes: null, weight: null, mood: null, energy: null, sleep: null, hunger: null, ...extra })
const source = (journal = [], extra = {}) => ({ journal, events: [], weightUnit: 'lbs', ...extra })
const model = (data, range = '7D', today = '2026-09-24') => commandCenterModel(data, range, today)
const event = (id, date, protocolId = 'p', compoundId = null) => ({ id, date, event_type: 'started', description: null, protocol_id: protocolId, compound_id: compoundId, protocols: { id: protocolId, name: 'Same label', start_date: '2026-01-01', status: 'active', compounds: [{id:'c',name:'Known compound'}] }, compounds: null })

test('invalid timestamp calendar dates cannot roll into another month', () => {
  assert.equal(healthDate('2026-02-30T12:00:00Z'), null)
})

for (const [range, start, denominator] of [['7D','2026-09-18',7],['30D','2026-08-26',30],['90D','2026-06-27',90]]) {
  test(range+' includes both local boundaries and excludes old/future observations and events', () => {
    const data=source([row(shiftHealthDate(start,-1),{weight:999,sleep:24}),row(start,{weight:170,mood:2,sleep:6}),row('2026-09-24',{weight:171,mood:4,sleep:8}),row('2026-09-25',{weight:900,mood:1,sleep:0})],{events:normalizeTimeline([event('old',shiftHealthDate(start,-1)),event('start',start),event('end','2026-09-24'),event('future','2026-09-25')],[])})
    const value=model(data,range);assert.equal(value.start,start);assert.equal(value.days,denominator);assert.equal(value.recordedDays,2);assert.equal(value.weight.delta,1);assert.equal(value.signals[0].average,3);assert.equal(value.signals[2].average,7);assert.equal(value.events.length,2)
  })
}
test('All retains complete history and has no invented denominator',()=>{
  const value=model(source([row('2020-01-01',{notes:'Recorded'}),row('2026-09-24',{weight:180})]),'All');assert.equal(value.days,null);assert.equal(value.metrics[0].value,'2');assert.equal(value.start,'2020-01-01');assert.equal(value.period,'All recorded data')
})
test('logging counts distinct qualifying dates rather than rows, protocol changes, or blank entries',()=>{
  const value=model(source([row('2026-09-18',{notes:'Note'}),row('2026-09-18',{id:'another',mood:3}),row('2026-09-19',{weight:170}),row('2026-09-20',{sleep:0}),row('2026-09-21',{hunger:2}),row('2026-09-22'),row('bad',{notes:'invalid'}),row('2026-09-24',{mood:NaN,weight:Infinity,sleep:-1,energy:7})],{events:normalizeTimeline([event('e','2026-09-23')],[])}));assert.equal(value.recordedDays,4);assert.equal(value.metrics[0].value,'4/7')
})
test('duplicate source IDs cannot inflate means or logging',()=>{const a=row('2026-09-24',{mood:2});assert.equal(model(source([a,a,row('2026-09-23',{mood:4})])).signals[0].average,3)})
test('weight change uses chronological valid endpoints; zero and missing weights are omitted',()=>{
  const value=model(source([row('2026-09-24',{weight:181.2}),row('2026-09-18',{weight:183.5}),row('2026-09-19',{weight:0}),row('2026-09-20')]));assert.ok(Math.abs(value.weight.delta+2.3)<1e-9);assert.equal(value.metrics[1].value,'-2.3');assert.equal(value.weight.points.length,2);assert.ok(value.weight.domain[0]>0);assert.ok(value.weight.domain[0]<181.2);assert.ok(value.weight.domain[1]>183.5)
})
test('weight is converted from canonical lbs into saved kg, with signed one-decimal change',()=>{
 const value=model(source([row('2026-09-18',{weight:200}),row('2026-09-24',{weight:202})],{weightUnit:'kg'}));assert.equal(value.metrics[1].unit,'kg');assert.equal(value.metrics[1].value,'+0.9');assert.ok(Math.abs(value.weight.latest-202*.453592)<1e-9)
})
for (const journal of [[],[row('2026-09-24',{weight:170})]]) test(journal.length+' weights cannot imply a change',()=>{const value=model(source(journal));assert.equal(value.weight.delta,null);assert.equal(value.metrics[1].value,'Not enough data')})
test('conflicting same-day weights are not assigned arbitrary first/latest ordering',()=>{const value=model(source([row('2026-09-18',{weight:170}),row('2026-09-24',{weight:180}),row('2026-09-24',{id:'conflict',weight:190})]));assert.equal(value.weight.count,1);assert.equal(value.weight.delta,null);assert.equal(value.weight.ambiguousWeights,true)})
test('sleep and mood averages use valid observations only, including recorded zero sleep',()=>{
 const value=model(source([row('2026-09-18',{mood:2,sleep:0}),row('2026-09-19'),row('2026-09-20',{mood:4,sleep:8}),row('2026-09-21',{mood:0,sleep:-1}),row('2026-09-22',{mood:8,sleep:25}),row('2026-09-23',{mood:NaN,sleep:Infinity})]));assert.equal(value.signals[0].average,3);assert.equal(value.signals[2].average,4);assert.equal(value.signals[1].average,null)
})
test('separate Mood/Energy/Sleep scales and missing-day gaps never invent points',()=>{
 const value=model(source([row('2026-09-18',{mood:2,energy:3,sleep:7}),row('2026-09-21',{mood:4,energy:5,sleep:8})]));assert.deepEqual(value.signals.map(s=>s.name),['Mood','Energy','Sleep']);assert.deepEqual(value.signals[0].domain,[1,5]);assert.deepEqual(value.signals[1].domain,[1,5]);assert.deepEqual(value.signals[2].domain,[0,9]);assert.deepEqual(value.signals[0].points.map(p=>p.value),[2,null,4]);assert.equal(value.signals[0].points[1].date,'2026-09-19');assert.equal(value.signals[0].count,2)
})
test('empty and invalid-only input yield no fabricated observations or nonfinite display values',()=>{
 for(const data of [source(),source([row('2026-09-24',{weight:NaN,mood:Infinity,sleep:-1,energy:0})])]) {const value=model(data);assert.equal(value.recordedDays,0);assert.equal(value.weight.latest,null);assert.ok(value.signals.every(s=>s.average===null));assert.doesNotMatch(JSON.stringify(value),/NaN|Infinity/);assert.match(value.summary,/Record a check-in/)}
})
test('partial observations render independently and precision is bounded',()=>{
 const value=model(source([row('2026-09-24',{mood:4,sleep:7.333333333})]));assert.equal(value.metrics[2].value,'7.3');assert.equal(value.metrics[3].value,'4.0');assert.equal(value.metrics[1].value,'Not enough data');assert.equal(value.signals[1].average,null)
})
test('summary is deterministic, descriptive and independent of protocol labels',()=>{
 const journal=Array.from({length:7},(_,i)=>row(shiftHealthDate('2026-09-18',i),{sleep:7,mood:3}));const value=model(source(journal,{events:normalizeTimeline([event('e','2026-09-24')],[])}));assert.equal(value.headline,'A consistent week');assert.match(value.summary,/7 of 7 days/);assert.doesNotMatch(value.summary,/caus|improv|Known compound|Same label|recommend/i);assert.equal(model(source(journal),'All').headline,'Your long-term view')
})
test('protocol context retains canonical normalized titles and exact protocol/compound scopes',()=>{
 const normalized=normalizeTimeline([event('protocol','2026-09-24'),event('unknown','2026-09-24','p','missing-compound'),event('other','2026-09-24','other','c')],[]);const value=model(source([],{events:normalized}));for(const item of value.events){assert.equal(item.title,normalized.find(e=>e.id===item.id).title);const identity=parseTreatmentIdentityKey(new URL(item.href,'https://example.test').searchParams.get('treatment'));assert.deepEqual(identity,{protocolId:item.metadata.protocolId,compoundId:item.metadata.compoundId})};assert.equal(value.events.find(e=>e.sourceId==='protocol').scope,'Protocol change');assert.equal(value.events.find(e=>e.sourceId==='unknown').scope,'Compound change')
})
test('unresolved event identity remains text with no invented treatment link',()=>{const value=model(source([],{events:normalizeTimeline([{...event('orphan','2026-09-24',null),protocols:null}],[])}));assert.equal(value.events[0].href,null)})
test('local dates and range boundaries hold across DST and opposite time zones',()=>{
 const previous=process.env.TZ;try{for(const zone of ['America/New_York','Pacific/Honolulu','Asia/Tokyo']){process.env.TZ=zone;assert.equal(healthDate('2026-03-08'),'2026-03-08');assert.equal(shiftHealthDate('2026-03-09',-6),'2026-03-03');assert.equal(model(source(), '7D','2026-03-09').start,'2026-03-03');assert.equal(new Date(calendarTime('2026-03-08')).getDate(),8)}process.env.TZ='America/New_York';assert.equal(healthDate('2026-09-25T01:00:00Z'),'2026-09-24');process.env.TZ='Asia/Tokyo';assert.equal(healthDate('2026-09-25T01:00:00Z'),'2026-09-25')}finally{process.env.TZ=previous}
})
test('date-only invalid dates are rejected and single-day All has no tomorrow label',()=>{assert.equal(healthDate('2026-02-30'),null);const value=model(source([row('2026-09-24',{weight:170})]),'All');assert.equal(new Date(value.xDomain[1]).getDate(),24)})
test('weight x-domain uses its first and last observations while coordinates keep real chronological spacing',()=>{const weight=model(source([row('2026-09-18',{weight:170}),row('2026-09-19',{weight:171}),row('2026-09-24',{weight:172})])).weight,p=weight.points;assert.deepEqual(weight.xDomain,[p[0].time,p[2].time]);assert.ok(p[2].time-p[1].time>4*(p[1].time-p[0].time))})
test('one weight is centered and two weights occupy their actual date boundaries',()=>{
 const one=model(source([row('2026-09-20',{weight:170})])).weight;assert.equal(one.points[0].time-one.xDomain[0],one.xDomain[1]-one.points[0].time)
 const two=model(source([row('2026-09-18',{weight:170}),row('2026-09-24',{weight:172})])).weight;assert.deepEqual(two.xDomain,[two.points[0].time,two.points[1].time])
})

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
test('Today removes the entire analytics block while retaining action slots, rings, and CSV export',()=>{
 const page=read('../app/protocol/page.tsx');assert.doesNotMatch(page,/Charts & weekly recap|Week recap|Hide charts|WeeklySummary|ReferenceLine|LineChart|today-dashboard-tools/);for(const text of ['<TodayOverview','<CompoundRings','<WeeklySchedule','<DailyCheckIn','exportToCSV','onboardingEligible'])assert.ok(page.includes(text))
})
test('Health integrates one overview with existing Labs, Analyst, Changes, Reports and imports',()=>{
 const page=read('../components/health/HealthDashboard.tsx')+read('../components/health/HealthNavigation.tsx');assert.match(page,/useState<HealthRange>\('7D'\)/);for(const text of ['<HealthCommandCenter','/health?view=labs','/health?view=analyst','/health?view=changes','/health/report','/health?action=add','/health?action=csv','/health?action=pdf','<HealthBriefing','<LabInsights'])assert.ok(page.includes(text));assert.match(page,/range=\{overviewRange\}/);assert.match(read('../components/app/BottomTabBar.tsx'),/href: '\/health'/)
})
test('Recharts uses numeric time, one measure, separate rows, accessible text inspection, and bounded motion',()=>{
 const chart=read('../components/health/HealthTrendChart.tsx'),shell=read('../components/health/HealthCommandCenter.tsx'),css=read('../components/health/command-center.module.css');assert.match(chart,/dataKey="time" type="number"/);assert.match(chart,/connectNulls=\{false\}/);assert.match(chart,/animationDuration=\{320\}/);assert.match(chart,/accessibilityLayer/);assert.match(chart,/<select/);assert.doesNotMatch(chart,/ReferenceLine|event.title/);assert.ok(shell.indexOf('<CommandBriefing model=')>shell.indexOf('<HealthDailySignals model='));assert.match(css,/prefers-reduced-motion: reduce/);assert.match(css,/animation: none/);assert.match(css,/color: var\(--app-text\)/);assert.match(css,/color: var\(--app-secondary\)/)
})
test('weight chart uses an unsmoothed line, bounded date labels, and no decorative gradient',()=>{
 const chart=read('../components/health/HealthTrendChart.tsx');assert.match(chart,/type="linear"/);assert.match(chart,/recorded\.length === 2/);assert.match(chart,/weigh-ins/);assert.doesNotMatch(chart,/AreaChart|linearGradient/)
})
test('chart copy renders a real middle dot and never exposes the Unicode escape text',()=>{
 const chart=read('../components/health/HealthTrendChart.tsx'),literalEscape=String.fromCharCode(92)+'u00b7';assert.ok(!chart.includes(literalEscape));assert.match(chart,/Weekly averages from recorded check-ins ·/);assert.match(chart,/\{date\} · \{trend\.name\}/)
})

test('shared source reader paginates both sources and scopes every page to the authenticated owner',async()=>{
 const calls=[];const client={from(table){const query={select(){return this},eq(key,value){calls.push([table,key,value]);return this},order(){return this},range(from,to){this.from=from;this.to=to;return this},returns(){return this},then(resolve){const data=this.from===0?Array.from({length:500},(_,i)=>({id:String(i)})):[{id:'last'}];return Promise.resolve({data,error:null}).then(resolve)}};return query}};const {readTimelineEntries}=load('../lib/health/loadTimeline.ts',{'../supabase':{createClient:()=>client}});const data=await readTimelineEntries(client,'owner');assert.equal(data.journalEntries.length,501);assert.equal(data.protocolEvents.length,501);assert.deepEqual(calls,[['protocol_events','user_id','owner'],['journal_entries','user_id','owner'],['protocol_events','user_id','owner'],['journal_entries','user_id','owner']])
})
test('loader reads saved unit by profile owner key and does not mask a failed preference read',async()=>{
 let error=null;const client={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from(table){assert.equal(table,'user_profiles');return {select(field){assert.equal(field,'weight_unit');return this},eq(field,id){assert.equal(field,'id');assert.equal(id,'owner');return this},maybeSingle:async()=>({data:{weight_unit:'kg'},error})}}};const {loadCommandCenter}=load('../lib/health/loadCommandCenter.ts',{'../supabase':{createClient:()=>client},'./loadTimeline':{readTimelineEntries:async()=>({protocolEvents:[],journalEntries:[]}),TimelineAuthError:class extends Error{}}});assert.equal((await loadCommandCenter()).weightUnit,'kg');error={message:'private'};await assert.rejects(()=>loadCommandCenter(),/temporarily unavailable/)
})

// Coverage is a presentation rule over distinct recorded days, not adherence.
const signalRows=(offsets,extra={})=>offsets.map((offset,i)=>row(shiftHealthDate('2026-09-24',-offset),{mood:3,energy:4,sleep:7,...extra,id:'coverage-'+i}));
test('9 of 90 days suppresses all signal trends without suppressing intermittent weight',()=>{
 const value=model(source(signalRows([0,1,2,10,20,30,40,50,80],{weight:180})),'90D');assert.equal(value.checkInDays,9);assert.equal(value.signalsHaveTrend,false);for(const signal of value.signals){assert.equal(signal.state,'sparse');assert.equal(signal.count,9);assert.equal(signal.recordedDays,9);assert.equal(signal.coverage,.1)}assert.equal(value.weight.count,9);assert.equal(value.metrics[2].detail,'Average across 9 entries');assert.match(value.summary,/You recorded 9 of 90 days/);assert.match(value.summary,/across 9 recorded entries/)
});
for(const [range,below,above] of [['7D',4,5],['30D',11,12]])test(range+' recorded-day boundary is deterministic',()=>{
 assert.equal(model(source(signalRows(Array.from({length:below},(_,i)=>i))),range).signals[0].state,'sparse');assert.equal(model(source(signalRows(Array.from({length:above},(_,i)=>i))),range).signals[0].state,'trend');
});
test('none and single are distinct, with the exact single value and date',()=>{
 assert.equal(model(source()).signals[0].state,'none');const signal=model(source(signalRows([2]))).signals[0];assert.equal(signal.state,'single');assert.deepEqual(signal.firstObservation,{date:'2026-09-22',value:3});assert.equal(signal.count,1)
});
test('mixed coverage is per signal; weight-only and note-only days do not count as check-ins',()=>{
 const rows=signalRows(Array.from({length:30},(_,i)=>i)).map((r,i)=>({...r,energy:i<2?4:null,sleep:null}));rows.push(row('2026-08-26',{id:'weight-only',weight:180}),row('2026-08-27',{id:'note-only',notes:'Note'}));const value=model(source(rows),'30D');assert.deepEqual(value.signals.map(s=>s.state),['trend','sparse','none']);assert.equal(value.signals[1].count,2);assert.equal(value.signals[2].average,null);assert.equal(value.signalsHaveTrend,true)
});
test('multiple same-day entries cannot inflate coverage but retain observation counts and means',()=>{
 const rows=Array.from({length:9},(_,i)=>row('2026-09-24',{id:'same-day-'+i,mood:3}));const value=model(source(rows),'7D');assert.equal(value.signals[0].count,9);assert.equal(value.signals[0].recordedDays,1);assert.equal(value.signals[0].state,'sparse');assert.equal(value.checkInDays,1)
});
const weekOffsets=(weeks,days)=>Array.from({length:weeks},(_,w)=>Array.from({length:days},(_,d)=>10+w*7-d)).flat();
const allWeekRows=(totalWeeks,qualifying={})=>{
 const starts=Array.from({length:totalWeeks},(_,week)=>shiftHealthDate('2026-09-21',-7*(totalWeeks-1-week)))
 const sets=Object.fromEntries(['mood','energy','sleep'].map(key=>[key,new Set(qualifying[key]??[])]))
 return starts.flatMap((date,week)=>{
  const first=row(date,{id:'week-'+week+'-first',mood:3,energy:4,sleep:7}),secondDate=shiftHealthDate(date,1)
  const second=row(secondDate,{id:'week-'+week+'-second',mood:sets.mood.has(week)?3:null,energy:sets.energy.has(week)?4:null,sleep:sets.sleep.has(week)?7:null})
  return [first,...(sets.mood.has(week)||sets.energy.has(week)||sets.sleep.has(week)?[second]:[])]
 })
}
test('90D needs 30 distinct days across 6 local weeks',()=>{
 const offsets=weekOffsets(6,5);assert.equal(model(source(signalRows(offsets)),'90D').signals[0].state,'trend');assert.equal(model(source(signalRows(offsets.slice(1))),'90D').signals[0].state,'sparse');assert.equal(model(source(signalRows(Array.from({length:30},(_,i)=>i))),'90D').signals[0].state,'sparse');
});
test('All uses local Monday weeks and same-day duplicates do not qualify a week',()=>{
 const previous=process.env.TZ;try{for(const zone of ['America/New_York','Pacific/Honolulu','Asia/Tokyo']){process.env.TZ=zone;assert.equal(mondayForHealthDate('2026-09-21'),'2026-09-21');assert.equal(mondayForHealthDate('2026-09-27'),'2026-09-21')}}finally{process.env.TZ=previous}
 const journal=Array.from({length:4},(_,week)=>{const date=shiftHealthDate('2026-09-21',week*-7);return [row(date,{id:'same-'+week+'-a',mood:1}),row(date,{id:'same-'+week+'-b',mood:5})]}).flat()
 const signal=model(source(journal),'All').signals[0];assert.equal(signal.state,'sparse');assert.equal(signal.weekly.qualifyingWeeks,0);assert.equal(signal.count,8)
});
test('eight of 29 qualifying weeks does not render an All trend',()=>{
 const qualified=[0,4,8,12,16,20,24,28],value=model(source(allWeekRows(29,{mood:qualified,energy:qualified,sleep:qualified})),'All');for(const signal of value.signals){assert.equal(signal.state,'sparse');assert.deepEqual(signal.weekly,{qualifyingWeeks:8,totalWeeks:29});assert.ok(signal.chartPoints.every(point=>point.value===null))}
});
test('50 percent weekly coverage without four consecutive weeks does not qualify',()=>{
 const signal=model(source(allWeekRows(8,{mood:[0,1,4,5]})),'All').signals[0];assert.equal(signal.state,'sparse');assert.deepEqual(signal.weekly,{qualifyingWeeks:4,totalWeeks:8});assert.equal(signal.longestRun,2)
});
test('four consecutive qualifying weeks without 50 percent coverage does not qualify',()=>{
 const signal=model(source(allWeekRows(9,{mood:[1,2,3,4]})),'All').signals[0];assert.equal(signal.state,'sparse');assert.deepEqual(signal.weekly,{qualifyingWeeks:4,totalWeeks:9});assert.equal(signal.longestRun,4)
});
test('all All-range weekly requirements satisfied renders the weekly trend',()=>{
 const signal=model(source(allWeekRows(8,{mood:[2,3,4,5]})),'All').signals[0];assert.equal(signal.state,'trend');assert.deepEqual(signal.weekly,{qualifyingWeeks:4,totalWeeks:8});assert.equal(signal.longestRun,4);assert.deepEqual(signal.chartPoints.map(point=>point.value),[null,null,3,3,3,3,null,null]);assert.equal(signal.observations.length,4)
});
test('All supports mixed qualifying and compact weekly signal states',()=>{
 const value=model(source(allWeekRows(8,{mood:[2,3,4,5],energy:[0,1,4,5],sleep:[0,2,4]})),'All');assert.deepEqual(value.signals.map(signal=>signal.state),['trend','sparse','sparse']);assert.equal(value.signalsHaveTrend,true);assert.ok(value.signals[1].chartPoints.every(point=>point.value===null));assert.ok(value.signals[2].chartPoints.every(point=>point.value===null))
});
test('four of seven observations always stay compact without chart geometry',()=>{
 const value=model(source(signalRows([0,1,3,6])));assert.ok(value.signals.every(s=>s.state==='sparse'&&s.recordedDays===4&&s.chartPoints.every(p=>p.value===null)));assert.equal(value.signals[0].observations.length,4)
});
test('consecutive qualification is independent from raw entry counts',()=>{
 assert.equal(model(source(signalRows([0,1,3,4,6]))).signals[0].state,'sparse');const offsets=[0,1,2,4,5,6,8,9,10,12,13,14];assert.equal(model(source(signalRows(offsets)),'30D').signals[0].state,'sparse');
});
test('qualified geometry omits isolated observations and short runs without discarding exact values',()=>{
 const signal=model(source(signalRows([0,2,4,5,6]))).signals[0];assert.equal(signal.state,'trend');assert.equal(signal.chartPoints.filter(p=>p.value!==null).length,3);assert.equal(signal.observations.length,5);assert.ok(signal.chartPoints.some(p=>p.value===null));assert.ok(!signal.chartPoints.some(p=>p.value===0));
});
test('same-day individual values remain available for exact inspection',()=>{
 const signal=model(source([row('2026-09-24',{id:'a',mood:1}),row('2026-09-24',{id:'b',mood:5})])).signals[0];assert.equal(signal.average,3);assert.deepEqual(signal.observations.map(o=>o.value),[1,5]);assert.equal(signal.recordedDays,1)
});
test('briefing ranks measured change, material confidence, then aggregated activity with no duplicate feed',()=>{
 const data=source(signalRows([0,1,3,6]).map((r,i)=>({...r,weight:180+i})),{events:normalizeTimeline(Array.from({length:5},(_,i)=>event('activity-'+i,'2026-09-22','p'+i)),[])});const value=model(data);assert.deepEqual(value.briefing.map(i=>i.kind),['measured','confidence','activity']);assert.equal(new Set(value.briefing.map(i=>i.id)).size,3);assert.match(value.briefing[1].text,/4 of 7 days/);assert.match(value.briefing[1].text,/1 additional recorded day/);assert.match(value.briefing[2].text,/5 protocol changes were recorded on Sep 22/);assert.equal(value.briefing[2].href,'/timeline?category=protocols');assert.doesNotMatch(value.briefing.map(i=>i.text).join(' '),/caused|improved|recommend|medication|Known compound/i)
});
test('briefing compares adjacent equivalent periods only when both qualify',()=>{
 const current=signalRows([0,1,2,3,4],{mood:4,energy:null,sleep:null});const prior=signalRows([7,8,9,10,11],{mood:2,energy:null,sleep:null}).map(r=>({...r,id:'prior-'+r.id}));let value=model(source([...current,...prior]));assert.equal(value.briefing[0].text,'Mood averaged 4.0/5, +2.0 points versus the preceding 7 days (5 vs 5 recorded entries).');assert.ok(!model(source([...current,...prior.slice(1)])).briefing.some(i=>i.id==='signal-mood'));assert.ok(!model(source([...current.slice(1),...prior])).briefing.some(i=>i.id==='signal-mood'));assert.ok(!model(source([...current,...prior]),'All').briefing.some(i=>i.id==='signal-mood'));
});
test('weight no-net-change briefing does not claim every observed value was stable',()=>{
 const value=model(source([row('2026-09-18',{weight:180}),row('2026-09-20',{weight:184}),row('2026-09-24',{weight:180})]));assert.match(value.briefing[0].text,/no net change/);assert.doesNotMatch(value.briefing[0].text,/remained stable/)
});
test('activity aggregates dates deterministically and empty sources have no filler briefing',()=>{
 assert.deepEqual(model(source()).briefing,[]);const events=normalizeTimeline([event('a','2026-09-22','p1'),event('b','2026-09-22','p2'),event('c','2026-09-23','p3')],[]);const one=model(source([],{events})).briefing,two=model(source([],{events:[...events].reverse()})).briefing;assert.deepEqual(one,two);assert.equal(one.length,1);assert.match(one[0].text,/3 protocol changes were recorded across 2 days; 2 on Sep 22/)
});
test('shared Health navigation is top-level, includes imports on every view, and reports use it too',()=>{
 const page=read('../components/health/HealthDashboard.tsx'),nav=read('../components/health/HealthNavigation.tsx'),css=read('../components/health/health-navigation.module.css');assert.ok(page.indexOf('<HealthNavigation')<page.indexOf('<HealthCommandCenter'));assert.doesNotMatch(page,/More Health tools|healthLinks/);for(const text of ['Add / Import','Enter a health or lab result.','Upload structured health history.','Upload a lab report.'])assert.ok(nav.includes(text));for(const contract of [/aria-expanded=\{open\}/,/aria-controls=\{menu\}/,/aria-haspopup="menu"/,/role="menu"/,/role="menuitem"/,/pointerdown/,/focusin/,/Escape/])assert.match(nav,contract);assert.match(nav,/trigger\.current\?\.contains\(target\).*menuElement\.current\?\.contains\(target\)/s);assert.doesNotMatch(nav,/event\.key === ['"]Tab['"]/);assert.match(nav,/scrollLeft/);assert.match(nav,/aria-current/);assert.match(css,/overflow-x: auto/);assert.match(css,/position: fixed/);assert.doesNotMatch(css,/\.imports \{ display: flex/);assert.match(read('../components/health/DoctorReport.tsx'),/<HealthNavigation active="report"/)
});
test('browser fixture keeps fragmented weekly data sparse and has a fully qualified positive case',()=>{
 const browser=read('../tests/health-command-center.browser.cjs');assert.match(browser,/mode==='weekly-qualified'/);assert.equal(browser.match(/Two-week longest run stays compact/g)?.length,2);assert.equal(browser.match(/All requirements render/g)?.length,2);assert.doesNotMatch(browser,/Weekly averages from recorded check-ins · 4 of 6 weeks/)
})
