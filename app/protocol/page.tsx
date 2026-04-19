'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type DueCompound = { id: string; name: string; dose: string; protocol_name: string }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null): boolean {
  if (!protocolStart) return false
  const start = new Date(protocolStart + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)
  if (daysDiff < 0) return false
  if (frequency === 'daily') return true
  if (frequency === 'eod') return daysDiff % 2 === 0
  if (frequency === 'every3days') return daysDiff % 3 === 0
  if (frequency === 'every4days') return daysDiff % 4 === 0
  if (frequency === 'every5days') return daysDiff % 5 === 0
  const todayDay = today.getDay()
  if (frequency === '1x/week') return dayOfWeek !== null ? todayDay === dayOfWeek : daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = dayOfWeek ?? 0; return todayDay === d || todayDay === (d+3)%7 }
  if (frequency === '3x/week') return todayDay === 1 || todayDay === 3 || todayDay === 5
  if (frequency === '4x/week') return todayDay === 1 || todayDay === 2 || todayDay === 4 || todayDay === 5
  if (frequency === '5x/week') return todayDay >= 1 && todayDay <= 5
  if (frequency === '6x/week') return todayDay !== 0
  return false
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<any[]>([])
  const [activeProtocols, setActiveProtocols] = useState<any[]>([])
  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])
  const [logs, setLogs] = useState<Record<string, LogEntry>>({})
  const [currentWeek, setCurrentWeek] = useState(0)
  const [showChart, setShowChart] = useState(false)
  const [showProtocols, setShowProtocols] = useState(false)
  const [protocolEvents, setProtocolEvents] = useState<any[]>([])
  const [showAddEvent, setShowAddEvent] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [eventDesc, setEventDesc] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editEventDesc, setEditEventDesc] = useState('')
  const [editEventType, setEditEventType] = useState('')
  const [eventType, setEventType] = useState('dose_change')
  const [selectedProtocol, setSelectedProtocol] = useState<any>(null)
  const today = new Date().toISOString().split('T')[0]
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [hunger, setHunger] = useState<number | null>(null)
  const [sleep, setSleep] = useState('')
  const [weight, setWeight] = useState('')
  const [entryNotes, setEntryNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showNewProtocol, setShowNewProtocol] = useState(false)
  const [newName, setNewName] = useState('')
  const [prefillDose, setPrefillDose] = useState('')
  const [prefillVial, setPrefillVial] = useState('')
  const [prefillWater, setPrefillWater] = useState('')
  const [creatingProtocol, setCreatingProtocol] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const g = '#39ff14'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'

  useEffect(() => {
    loadAll()
    const params = new URLSearchParams(window.location.search)
    if (params.get('newprotocol') === '1') {
      setPrefillDose(params.get('dose') || '')
      setPrefillVial(params.get('vial') || '')
      setPrefillWater(params.get('water') || '')
      setShowNewProtocol(true)
      window.history.replaceState({}, '', '/protocol')
    }
  }, [])

  async function createProtocolFromCalc() {
    if (!newName.trim()) return
    setCreatingProtocol(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: protocol } = await supabase.from('protocols').insert({ user_id: user.id, name: newName.trim(), start_date: todayStr }).select().single()
    if (!protocol) { setCreatingProtocol(false); return }
    const { data: compound } = await supabase.from('compounds').insert({ protocol_id: protocol.id, user_id: user.id, name: newName.trim(), vial_strength: prefillVial ? parseFloat(prefillVial) : null, vial_unit: 'mg', bac_water_ml: prefillWater ? parseFloat(prefillWater) : null, reconstitution_date: todayStr }).select().single()
    if (!compound) { setCreatingProtocol(false); return }
    await supabase.from('phases').insert({ compound_id: compound.id, user_id: user.id, name: 'Phase 1', dose: parseFloat(prefillDose), dose_unit: 'mg', start_week: 1, end_week: 4, frequency: '1x/week' })
    await supabase.from('protocol_events').insert({ user_id: user.id, protocol_id: protocol.id, compound_id: compound.id, date: todayStr, event_type: 'started', description: 'Started ' + newName.trim() + ' at ' + prefillDose + 'mg' })
    setCreatingProtocol(false)
    setCreateSuccess(true)
    setShowNewProtocol(false)
    loadAll()
  }

  async function saveEvent() {
    if (!eventDesc.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('protocol_events').insert({ user_id: user.id, date: todayStr, event_type: eventType, description: eventDesc.trim() })
    setEventDesc(''); setShowAddEvent(false)
    loadAll()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    const supabase = createClient()
    await supabase.from('protocol_events').delete().eq('id', id)
    if (selectedEvent?.id === id) setSelectedEvent(null)
    loadAll()
  }

  async function updateEvent() {
    if (!editEventDesc.trim() || !editingEventId) return
    const supabase = createClient()
    await supabase.from('protocol_events').update({ description: editEventDesc.trim(), event_type: editEventType }).eq('id', editingEventId)
    setEditingEventId(null)
    loadAll()
  }

  function startEditEvent(ev: any) {
    setEditingEventId(ev.id)
    setEditEventDesc(ev.description)
    setEditEventType(ev.event_type)
  }

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: js } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })
    setEntries(js || [])
    const todayEntry = (js || []).find((e: any) => e.date === today)
    if (todayEntry) { setMood(todayEntry.mood); setEnergy(todayEntry.energy); setSleep(todayEntry.sleep?.toString() || ''); setWeight(todayEntry.weight?.toString() || ''); setHunger(todayEntry.hunger ?? null); setEntryNotes(todayEntry.notes || ''); setSaved(true) }
    const { data: protocols } = await supabase.from('protocols').select('id, start_date, name, notes, compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name))').eq('status', 'active')
    setActiveProtocols(protocols || [])
    if (protocols && protocols.length > 0) { const earliest = protocols.reduce((m: string, p: any) => p.start_date < m ? p.start_date : m, protocols[0].start_date); setCurrentWeek(Math.max(1, Math.floor((Date.now() - new Date(earliest+'T00:00:00').getTime()) / 86400000 / 7) + 1)) }
    const due: DueCompound[] = []
    ;(protocols || []).forEach((p: any) => { const daysIn = Math.floor((Date.now() - new Date(p.start_date+'T00:00:00').getTime()) / 86400000); const wk = Math.max(1, Math.floor(daysIn/7)+1); (p.compounds||[]).forEach((c: any) => { const phase = (c.phases||[]).find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || c.phases?.[0]; if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week)) due.push({ id: c.id, name: c.name, dose: phase.dose+phase.dose_unit, protocol_name: p.name }) }) })
    setDueCompounds(due)
    const { data: ls } = await supabase.from('injection_logs').select('*').eq('date', today)
    const map: Record<string, LogEntry> = {}; (ls || []).forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } }); setLogs(map)
    const { data: events } = await supabase.from('protocol_events').select('*').order('date', { ascending: true })
    setProtocolEvents(events || [])
    setLoading(false)
  }

  async function toggleInjection(cid: string) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const cur = logs[cid]; const t = !cur?.taken; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: t, discomfort: cur?.discomfort||0 }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: t, discomfort: cur?.discomfort||0 } }) }
  async function setDiscomfortVal(cid: string, v: number) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: true, discomfort: v }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: true, discomfort: v } }) }
  async function saveEntry() { setSaving(true); const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setSaving(false); return }; const row: any = { user_id: user.id, date: today, notes: entryNotes.trim() }; if (mood !== null) row.mood = mood; if (energy !== null) row.energy = energy; if (sleep) row.sleep = parseFloat(sleep); if (weight) row.weight = parseFloat(weight); if (hunger !== null) row.hunger = hunger; await supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,date' }); setSaving(false); setSaved(true); loadAll() }

  function ScoreBtn({ value, current, onChange, activeColor = g }: { value: number; current: number | null; onChange: (v: number) => void; activeColor?: string }) { const a = current === value; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?activeColor:cb,color:a?'#000':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{value}</button> }
  function DiscomfortBtn({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) { const a = current === value; const c = value === 0 ? g : '#ff6b6b'; return <button onClick={() => onChange(value)} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid '+(a?c:bd),background:a?(value===0?'rgba(57,255,20,0.15)':'rgba(255,107,107,0.15)'):'transparent',color:a?c:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>{value}</button> }

  function eventColor(type: string) { return type==='started'?g:type==='dose_change'?'#f59e0b':type==='compound_added'?'#06b6d4':type==='compound_removed'?'#ff6b6b':'#6c63ff' }

  const we = entries.filter((e: any) => e.weight).sort((a: any, b: any) => a.date.localeCompare(b.date))
  const sw = we[0]?.weight; const lw = we[we.length-1]?.weight
  const tl = (sw && lw) ? (sw - lw).toFixed(1) : null
  const cd = entries.slice().sort((a: any, b: any) => a.date.localeCompare(b.date)).map((e: any) => ({ date: new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}), mood: e.mood, energy: e.energy, sleep: e.sleep, weight: e.weight }))
  const ts = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }
  const mk: { date: string; label: string }[] = []
  activeProtocols.forEach((p: any) => { const sl = new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); (p.compounds||[]).forEach((c: any) => { mk.push({ date: sl, label: c.name }) }) })
  protocolEvents.forEach((ev: any) => { const evDate = new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); mk.push({ date: evDate, label: ev.description }) })

  const ins: { text: string; accent: string }[] = []
  if (we.length >= 2) { const diff = sw! - lw!; const db = Math.max(1, Math.floor((new Date(we[we.length-1].date).getTime() - new Date(we[0].date).getTime()) / 86400000)); const wb = Math.max(1, db/7); if (diff > 0) { ins.push({ text: `You're down ${diff.toFixed(1)} lbs since you started — keep going`, accent: g }); if (wb >= 2) { const wr = diff/wb; ins.push({ text: `Averaging ${wr.toFixed(1)} lbs lost per week`, accent: g }); ins.push({ text: `At this rate: ${(lw!-(wr*3)).toFixed(0)} lbs in 3 weeks`, accent: '#6c63ff' }) } } }
  if (entries.length >= 5) { const me = entries.filter((e: any) => e.mood !== null); if (me.length >= 3) { const am = me.reduce((s: number, e: any) => s+e.mood, 0)/me.length; ins.push({ text: `Mood trend: averaging ${am.toFixed(1)}/5 — ${am >= 4 ? 'strong' : am >= 3 ? 'stable' : 'review your recent changes'}`, accent: g }) } const rw = entries.slice(0,7).filter((e: any) => e.sleep !== null); if (rw.length >= 3) { const as2 = rw.reduce((s: number, e: any) => s+e.sleep, 0)/rw.length; ins.push({ text: `Sleep: ${as2.toFixed(1)} hrs avg this week — ${as2 >= 7.5 ? 'recovery on track' : as2 >= 6 ? 'watch for decline' : 'sleep quality needs attention'}`, accent: '#06b6d4' }) } }
  const he = entries.filter((e: any) => e.hunger !== null && e.hunger !== undefined); if (he.length >= 3) { const ah = he.reduce((s: number, e: any) => s+e.hunger, 0)/he.length; if (ah <= 2.5) ins.push({ text: `Appetite: suppressed (${ah.toFixed(1)}/5) — protocol is delivering`, accent: '#8b5cf6' }); else if (ah >= 4) ins.push({ text: `Appetite: elevated (${ah.toFixed(1)}/5) — track closely this week`, accent: '#f59e0b' }) }
  if (currentWeek > 0) ins.push({ text: `${currentWeek} week${currentWeek > 1 ? 's' : ''} into your cycle — consistency is paying off`, accent: '#6c63ff' })
  const vi = ins.slice(0, 3)

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:g,marginBottom:'4px'}}>Dashboard</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>You're building something. Keep going.</p>

        {createSuccess && (
          <div style={{background:'rgba(57,255,20,0.1)',border:'1px solid rgba(57,255,20,0.3)',borderRadius:'12px',padding:'16px',marginBottom:'16px',textAlign:'center'}}>
            <span style={{color:g,fontSize:'14px',fontWeight:'700'}}>✓ Protocol created!</span>
            <p style={{fontSize:'12px',color:dg,marginTop:'4px'}}>It's now in your active stack below.</p>
          </div>
        )}

        {showNewProtocol && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>CREATE FROM CALCULATOR</span>
            <p style={{fontSize:'12px',color:dg,marginBottom:'12px'}}>Dose: {prefillDose}mg · Vial: {prefillVial}mg · BAC: {prefillWater}mL</p>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}} />
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setShowNewProtocol(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={createProtocolFromCalc} disabled={creatingProtocol || !newName.trim()} style={{flex:2,background:creatingProtocol?'#1a3d1a':g,color:creatingProtocol?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{creatingProtocol ? 'Creating...' : 'Create Protocol'}</button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{lw ? lw+' lbs' : '—'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div></div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:tl !== null ? (parseFloat(tl) > 0 ? g : '#ff6b6b') : g}}>{tl !== null ? (parseFloat(tl) > 0 ? '-'+Math.abs(parseFloat(tl)) : '+'+Math.abs(parseFloat(tl)))+' lbs' : '—'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT CHANGE</div></div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:'#6c63ff'}}>{currentWeek > 0 ? 'Wk '+currentWeek : '—'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEEK OF CYCLE</div></div>
        </div>

        {/* Insights */}
        {vi.length > 0 && (<div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}><div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>{vi.map((ins2, i) => (<div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'white'}}><span style={{color:ins2.accent,fontWeight:'700'}}>→</span><span>{ins2.text}</span></div>))}</div>)}

        {/* Charts */}
        {entries.length > 1 && (<div style={{marginBottom:'16px'}}><button onClick={() => setShowChart(!showChart)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button></div>)}
        {showChart && cd.length > 1 && (<div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
<p style={{fontSize:'11px',color:mg,marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>MOOD, ENERGY & SLEEP</p><ResponsiveContainer width='100%' height={140}><LineChart data={cd}><XAxis dataKey='date' tick={{fontSize:10,fill:mg}} /><YAxis tick={{fontSize:10,fill:mg}} width={20} /><Tooltip {...ts} />{mk.map((m, i) => <ReferenceLine key={'m1_'+i} x={m.date} stroke='#6c63ff' strokeDasharray='4 4' strokeOpacity={0.5} label={{value: m.label, position: i % 2 === 0 ? 'insideTopRight' : 'insideBottomRight', fontSize: 10, fill: '#a78bfa', fontWeight: 700, offset: 8}} />)}<Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' /><Line type='monotone' dataKey='energy' stroke='#f97316' strokeWidth={2} dot={false} name='Energy' /><Line type='monotone' dataKey='sleep' stroke='#06b6d4' strokeWidth={2} dot={false} name='Sleep' /></LineChart></ResponsiveContainer>{protocolEvents.length > 0 && (
              <div style={{marginTop:'8px',marginBottom:'8px',padding:'8px 0',borderTop:'1px solid '+bd}}>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:'9px',color:mg,fontWeight:'600',marginRight:'4px'}}>EVENTS</span>
                  {protocolEvents.map((ev: any, i: number) => (
                    <button key={ev.id||i} onClick={() => setSelectedEvent(selectedEvent?.id===ev.id?null:ev)} title={ev.description} style={{width:'16px',height:'16px',borderRadius:'50%',background:selectedEvent?.id===ev.id?eventColor(ev.event_type):'transparent',border:'2px solid '+eventColor(ev.event_type),cursor:'pointer',padding:0}}>
                    </button>
                  ))}
                </div>
                {selectedEvent && (
                  <div style={{marginTop:'8px',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:eventColor(selectedEvent.event_type),marginTop:'4px',flexShrink:0}} />
                    <div style={{flex:1}}>
                      <span style={{fontSize:'10px',color:eventColor(selectedEvent.event_type),fontWeight:'700',textTransform:'uppercase'}}>{selectedEvent.event_type.replace(/_/g,' ')}</span>
                      <span style={{fontSize:'12px',color:'white',fontWeight:'600',display:'block',marginTop:'2px'}}>{selectedEvent.description}</span>
                      <span style={{fontSize:'10px',color:dg,display:'block',marginTop:'2px'}}>{new Date(selectedEvent.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                    </div>
                    <button onClick={() => setSelectedEvent(null)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>×</button>
                  </div>
                )}
              </div>
            )}
            {we.length > 1 && (<><p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT</p><ResponsiveContainer width='100%' height={100}><LineChart data={cd.filter((d: any) => d.weight)}><XAxis dataKey='date' tick={{fontSize:10,fill:mg}} /><YAxis tick={{fontSize:10,fill:mg}} width={30} domain={['auto','auto']} /><Tooltip {...ts} />{mk.map((m, i) => <ReferenceLine key={'m2_'+i} x={m.date} stroke='#6c63ff' strokeDasharray='4 4' strokeOpacity={0.5} />)}<Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name='Weight' /></LineChart></ResponsiveContainer></>)}</div>)}

        {/* Active Compounds */}
        {activeProtocols.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}><span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>ACTIVE COMPOUNDS</span><button onClick={() => setShowProtocols(!showProtocols)} style={{background:'none',border:'none',color:'#8b8ba7',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>{showProtocols ? 'Hide details' : 'Manage stack →'}</button></div>
            {activeProtocols.map((p: any) => { const daysIn = Math.max(0, Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000)); const wk = Math.max(1,Math.floor(daysIn/7)+1); return (p.compounds||[]).map((c: any) => { const phase = (c.phases||[]).find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || c.phases?.[0]; if (!phase) return null; const ssd = 30; const lp = Math.min(100, Math.round((daysIn/ssd)*100)); const il = lp >= 100; return (<div key={c.id} style={{padding:'8px 0',borderBottom:'1px solid '+bd}}><div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{c.name}</span><span style={{fontSize:'12px',color:dg}}>{phase.dose}{phase.dose_unit} · {phase.frequency}</span></div>
                    {c.reconstitution_date && (() => { const rd = new Date(c.reconstitution_date+'T00:00:00'); const daysSince = Math.floor((Date.now()-rd.getTime())/86400000); const daysLeft = 28-daysSince; const pct = Math.min(100, Math.round((daysSince/28)*100)); return (<div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}><span style={{fontSize:'12px',fontWeight:'700',color:daysLeft<=5?'#ff6b6b':daysLeft<=10?'#f59e0b':'#c4c4dd'}}>💉 Vial: {daysLeft > 0 ? daysLeft+'d left' : 'expired'} ({daysSince}d old)</span></div>) })()}<div style={{background:'#0a0a0f',borderRadius:'6px',height:'22px',overflow:'hidden',position:'relative'}}><div style={{height:'100%',width:lp+'%',background:il?g:'linear-gradient(90deg, #6c63ff, #8b5cf6)',borderRadius:'6px',transition:'width 0.5s ease'}} /><span style={{position:'absolute',top:0,left:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',color:'white',letterSpacing:'0.5px'}}>{il ? '✓ STEADY STATE' : 'Day '+daysIn+'/'+ssd+' · Protocol Loading ('+lp+'%)'}</span></div></div>) }) })}
            {showProtocols && activeProtocols.map((p: any) => (<div key={p.id} style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid '+bd}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'14px',fontWeight:'700',color:g}}>{p.name}</span><a href='/protocol' style={{fontSize:'11px',color:mg,textDecoration:'none'}}>Edit →</a></div>{p.notes && <p style={{fontSize:'12px',color:dg,marginTop:'4px'}}>{p.notes}</p>}</div>))}
          </div>
        )}

        {/* Event logger */}
        <div style={{marginBottom:'16px'}}>
          {!showAddEvent ? (
            <button onClick={() => setShowAddEvent(true)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'12px',cursor:'pointer',fontWeight:'600'}}>+ Log protocol change</button>
          ) : (
            <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>LOG PROTOCOL CHANGE</span>
              <select value={eventType} onChange={e => setEventType(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}>
                <option value='dose_change'>Dose changed</option>
                <option value='compound_added'>Added compound</option>
                <option value='compound_removed'>Stopped compound</option>
                <option value='phase_change'>Phase change</option>
                <option value='other'>Other</option>
              </select>
              <input value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder='e.g. Increased Reta to 5mg' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}} />
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => setShowAddEvent(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                <button onClick={saveEvent} disabled={!eventDesc.trim()} style={{flex:2,background:!eventDesc.trim()?'#1a3d1a':g,color:!eventDesc.trim()?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>Log Event</button>
              </div>
            </div>
          )}
        </div>

        {/* Recent events */}
        {protocolEvents.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>PROTOCOL TIMELINE</span>
            {protocolEvents.slice(-5).reverse().map((ev: any, i: number) => (
              editingEventId === ev.id ? (
                <div key={ev.id} style={{padding:'10px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>
                  <select value={editEventType} onChange={e => setEditEventType(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'6px',color:'white',fontSize:'12px',boxSizing:'border-box',marginBottom:'6px'}}>
                    <option value='dose_change'>Dose changed</option>
                    <option value='compound_added'>Added compound</option>
                    <option value='compound_removed'>Stopped compound</option>
                    <option value='phase_change'>Phase change</option>
                    <option value='started'>Started</option>
                    <option value='other'>Other</option>
                  </select>
                  <input value={editEventDesc} onChange={e => setEditEventDesc(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'13px',boxSizing:'border-box',marginBottom:'6px'}} />
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={() => setEditingEventId(null)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'6px',fontSize:'12px',cursor:'pointer'}}>Cancel</button>
                    <button onClick={updateEvent} style={{flex:2,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'6px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save</button>
                  </div>
                </div>
              ) : (
                <div key={ev.id || i} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'8px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:eventColor(ev.event_type),marginTop:'4px',flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}><span style={{fontSize:'10px',color:'#0a0a0f',background:eventColor(ev.event_type),padding:'2px 6px',borderRadius:'4px',fontWeight:'700',textTransform:'uppercase'}}>{ev.event_type.replace(/_/g,' ')}</span><span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{ev.description}</span></div>
                    <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginTop:'2px'}}>{new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  </div>
                  <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                    <button onClick={() => startEditEvent(ev)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'11px'}}>Edit</button>
                    <button onClick={() => deleteEvent(ev.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'11px'}}>Delete</button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Today's injections */}
        {dueCompounds.length > 0 && (<div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}><span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>TODAY'S INJECTIONS</span><span style={{fontSize:'12px',color:mg}}>{Object.values(logs).filter(l => l.taken).length}/{dueCompounds.length}</span></div>{dueCompounds.map(c => { const log = logs[c.id]; const taken = log?.taken||false; const dis = log?.discomfort||0; return (<div key={c.id} style={{background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}><div style={{display:'flex',alignItems:'center',gap:'12px'}}><button onClick={() => toggleInjection(c.id)} style={{width:'26px',height:'26px',borderRadius:'6px',border:'1px solid '+(taken?g:bd),background:taken?g:'transparent',cursor:'pointer',color:'#000',fontWeight:'800',padding:0}}>{taken?'✓':''}</button><div style={{flex:1}}><div style={{fontSize:'14px',fontWeight:'600',color:taken?dg:'white',textDecoration:taken?'line-through':'none'}}>{c.name}</div><div style={{fontSize:'11px',color:mg}}>{c.dose} · {c.protocol_name}</div></div></div>{taken && (<div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid '+bd}}><span style={{fontSize:'10px',color:mg,display:'block',marginBottom:'6px',letterSpacing:'1px'}}>DISCOMFORT (0 = none)</span><div style={{display:'flex',gap:'6px'}}>{[0,1,2,3,4,5].map(n => <DiscomfortBtn key={n} value={n} current={dis} onChange={v => setDiscomfortVal(c.id, v)} />)}</div></div>)}</div>) })}</div>)}

        {/* Daily log */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}><span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>DAILY LOG</span>{saved && <span style={{fontSize:'11px',color:g}}>✓ saved</span>}</div>
          <div style={{marginBottom:'12px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'12px',color:dg}}>Mood</span><div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={mood} onChange={setMood} />)}</div></div></div>
          <div style={{marginBottom:'12px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'12px',color:dg}}>Energy</span><div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={energy} onChange={setEnergy} activeColor='#f97316' />)}</div></div></div>
          <div style={{marginBottom:'12px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'12px',color:dg}}>Hunger</span><div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={hunger} onChange={setHunger} activeColor='#8b5cf6' />)}</div></div></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}><div><span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Sleep (hrs)</span><input type='number' step='0.5' value={sleep} onChange={e => setSleep(e.target.value)} placeholder='7.5' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box'}} /></div><div><span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Weight (lbs)</span><input type='number' step='0.1' value={weight} onChange={e => setWeight(e.target.value)} placeholder='optional' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box'}} /></div></div>
          <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder='Notes...' rows={2} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'13px',boxSizing:'border-box',resize:'none',marginBottom:'12px'}} />
          <button onClick={saveEntry} disabled={saving} style={{width:'100%',background:saving?'#1a3d1a':g,color:saving?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>{saving?'Saving...':saved?'Update':'Save'}</button>
        </div>






      </div>
    </main>
  )
}