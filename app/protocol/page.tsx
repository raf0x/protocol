'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import StatsBar from '../../components/dashboard/StatsBar'
import InsightsCard from '../../components/dashboard/InsightsCard'
import DailyLogCard from '../../components/dashboard/DailyLogCard'
import CompoundNotes from '../../components/dashboard/CompoundNotes'
import VialInventory from '../../components/dashboard/VialInventory'
import WeeklySummary from '../../components/dashboard/WeeklySummary'
import { isDueToday, getDaysIn, getCurrentWeek, eventColor } from '../../lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

type DueCompound = { id: string; name: string; dose: string; protocol_name: string }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

// isDueToday moved to lib/utils.ts

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [activeProtocols, setActiveProtocols] = useState<any[]>([])
  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])
  const [logs, setLogs] = useState<Record<string, LogEntry>>({})
  const [currentWeek, setCurrentWeek] = useState(0)
  const [showChart, setShowChart] = useState(false)
  const [showSummary, setShowSummary] = useState(new Date().getDay() === 0)
  const [showProtocols, setShowProtocols] = useState(false)
  const [activeCompoundTab, setActiveCompoundTab] = useState<string | null>(null)
  const tabRowRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const scrollStartX = useRef(0)
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
  const [missedDoses, setMissedDoses] = useState<string[]>([])
  const [showNewProtocol, setShowNewProtocol] = useState(false)
  const [newName, setNewName] = useState('')
  const [prefillDose, setPrefillDose] = useState('')
  const [prefillVial, setPrefillVial] = useState('')
  const [prefillWater, setPrefillWater] = useState('')
  const [creatingProtocol, setCreatingProtocol] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const mg = 'var(--color-muted)'
  const cb = 'var(--color-card)'
  const bd = 'var(--color-border)'

  useEffect(() => {
    loadAll()
    const pending = localStorage.getItem('pendingProtocol')
    if (pending) {
      try {
        const p = JSON.parse(pending)
        setNewName(p.name || '')
        setPrefillDose(p.dose?.toString() || '')
        setPrefillVial(p.vial?.toString() || '')
        setPrefillWater(p.water?.toString() || '')
        setShowNewProtocol(true)
        localStorage.removeItem('pendingProtocol')
      } catch(e) { localStorage.removeItem('pendingProtocol') }
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
    setLoadError(false)
    try {
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
    // Missed dose detection � flag due compounds not logged after 8pm
    const hour = new Date().getHours()
    if (hour >= 20) {
      const logMap: Record<string, boolean> = {}
      ;(ls || []).forEach((l: any) => { if (l.taken) logMap[l.compound_id] = true })
      const missed = due.filter((c: any) => !logMap[c.id]).map((c: any) => c.name)
      setMissedDoses(missed)
    }
    setLoading(false)
    } catch (err) {
      console.error('loadAll failed:', err)
      setLoadError(true)
      setLoading(false)
    }
  }

  async function toggleInjection(cid: string) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const cur = logs[cid]; const t = !cur?.taken; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: t, discomfort: cur?.discomfort||0 }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: t, discomfort: cur?.discomfort||0 } }) }
  async function setDiscomfortVal(cid: string, v: number) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: true, discomfort: v }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: true, discomfort: v } }) }
  async function saveEntry() { setSaving(true); const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setSaving(false); return }; const row: any = { user_id: user.id, date: today, notes: entryNotes.trim() }; if (mood !== null) row.mood = mood; if (energy !== null) row.energy = energy; if (sleep) row.sleep = parseFloat(sleep); if (weight) row.weight = parseFloat(weight); if (hunger !== null) row.hunger = hunger; await supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,date' }); setSaving(false); setSaved(true); loadAll() }

  function ScoreBtn({ value, current, onChange, activeColor = g }: { value: number; current: number | null; onChange: (v: number) => void; activeColor?: string }) { const a = current === value; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?activeColor:cb,color:a?'#000':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{value}</button> }
  function DiscomfortBtn({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) { const a = current === value; const c = value === 0 ? g : '#ff6b6b'; return <button onClick={() => onChange(value)} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid '+(a?c:bd),background:a?(value===0?'var(--color-green-15)':'rgba(255,107,107,0.15)'):'transparent',color:a?c:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>{value}</button> }

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
    <main style={{minHeight:'100vh',color:'var(--color-text)',padding:'28px 22px 100px 22px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:g,marginBottom:'4px'}}>Dashboard</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>Every day logged is data working for you.</p>

        {createSuccess && (
          <div style={{background:'var(--color-green-10)',border:'1px solid var(--color-green-30)',borderRadius:'12px',padding:'16px',marginBottom:'16px',textAlign:'center'}}>
            <span style={{color:g,fontSize:'14px',fontWeight:'700'}}>✓ Protocol created!</span>
            <p style={{fontSize:'12px',color:dg,marginTop:'4px'}}>It's now in your active stack below.</p>
          </div>
        )}

        {showNewProtocol && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>CREATE FROM CALCULATOR</span>
            <p style={{fontSize:'12px',color:dg,marginBottom:'12px'}}>Dose: {prefillDose}mg · Vial: {prefillVial}mg · BAC: {prefillWater}mL</p>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}} />
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setShowNewProtocol(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={createProtocolFromCalc} disabled={creatingProtocol || !newName.trim()} style={{flex:2,background:creatingProtocol?'#1a3d1a':g,color:creatingProtocol?mg:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{creatingProtocol ? 'Creating...' : 'Create Protocol'}</button>
            </div>
          </div>
        )}

        {/* Stats � StatsBar component */}
        <StatsBar
          currentWeight={lw ?? null}
          totalLost={tl}
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          setActiveCompoundTab={setActiveCompoundTab}
        />

        {/* Weekly summary � Sundays only */}
        <WeeklySummary entries={entries} currentWeek={currentWeek} forceShow={showSummary} />

        {/* Missed dose banner */}
        {missedDoses.length > 0 && (
          <div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'12px',padding:'14px 16px',marginBottom:'16px',display:'flex',alignItems:'flex-start',gap:'10px'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>&#9888;</span>
            <div>
              <span style={{fontSize:'12px',fontWeight:'700',color:'#f97316',display:'block',marginBottom:'2px'}}>Looks like you may have missed a dose today</span>
              <span style={{fontSize:'12px',color:'var(--color-dim)'}}>{missedDoses.join(', ')} {missedDoses.length === 1 ? 'was' : 'were'} due but not logged. Tap the compound tab to log it.</span>
            </div>
          </div>
        )}

        {/* Insights � InsightsCard component */}
        <InsightsCard insights={vi} />

        {/* Charts + Summary toggles */}
        {entries.length > 1 && (
          <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
            <button onClick={() => setShowChart(!showChart)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button>
            <button onClick={() => setShowSummary(!showSummary)} style={{flex:1,background:showSummary?'var(--color-green-10)':cb,color:showSummary?'var(--color-green)':dg,border:'1px solid '+(showSummary?'var(--color-green-30)':bd),borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>Week recap</button>
          </div>
        )}
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
                  <div style={{marginTop:'8px',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:eventColor(selectedEvent.event_type),marginTop:'4px',flexShrink:0}} />
                    <div style={{flex:1}}>
                      <span style={{fontSize:'10px',color:eventColor(selectedEvent.event_type),fontWeight:'700',textTransform:'uppercase'}}>{selectedEvent.event_type.replace(/_/g,' ')}</span>
                      <span style={{fontSize:'12px',color:'var(--color-text)',fontWeight:'600',display:'block',marginTop:'2px'}}>{selectedEvent.description}</span>
                      <span style={{fontSize:'10px',color:dg,display:'block',marginTop:'2px'}}>{new Date(selectedEvent.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                    </div>
                    <button onClick={() => setSelectedEvent(null)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>×</button>
                  </div>
                )}
              </div>
            )}
            {we.length > 1 && (<><p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT</p><ResponsiveContainer width='100%' height={100}><LineChart data={cd.filter((d: any) => d.weight)}><XAxis dataKey='date' tick={{fontSize:10,fill:mg}} /><YAxis tick={{fontSize:10,fill:mg}} width={30} domain={['auto','auto']} /><Tooltip {...ts} />{mk.map((m, i) => <ReferenceLine key={'m2_'+i} x={m.date} stroke='#6c63ff' strokeDasharray='4 4' strokeOpacity={0.5} />)}<Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name='Weight' /></LineChart></ResponsiveContainer></>)}</div>)}

        {/* Active Compounds - Tabbed */}
        {activeProtocols.length > 0 && (() => {
          const allCompounds = activeProtocols.flatMap((p: any) => (p.compounds || []).map((c: any) => ({ ...c, protocol: p })))
          const tabId = activeCompoundTab || allCompounds[0]?.id
          const active = allCompounds.find((c) => c.id === tabId)
          const ap = active?.protocol
          return (
            <div style={{marginBottom:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <span id='active-compounds' style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>ACTIVE COMPOUNDS</span>
                <a href='/protocol/manage' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'12px',fontWeight:'700'}}>+ Add / Edit →</a>
              </div>
              <div ref={tabRowRef} onMouseDown={(e)=>{isDragging.current=true;dragStartX.current=e.pageX;scrollStartX.current=tabRowRef.current!.scrollLeft;tabRowRef.current!.style.cursor='grabbing'}} onMouseMove={(e)=>{if(!isDragging.current)return;e.preventDefault();tabRowRef.current!.scrollLeft=scrollStartX.current-(e.pageX-dragStartX.current)}} onMouseUp={()=>{isDragging.current=false;if(tabRowRef.current)tabRowRef.current.style.cursor='grab'}} onMouseLeave={()=>{isDragging.current=false;if(tabRowRef.current)tabRowRef.current.style.cursor='grab'}} style={{display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px',scrollbarWidth:'none',msOverflowStyle:'none',cursor:'grab',userSelect:'none'}}>
                {allCompounds.map((c, ci) => { const tc = ['var(--color-green)','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635'][ci] || g; const isAct = tabId===c.id; return (
                  <button key={c.id} onClick={() => setActiveCompoundTab(c.id)} style={{padding:'8px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,border:isAct?'1px solid '+tc:'1px solid '+bd,background:isAct?('rgba('+parseInt(tc.slice(1,3),16)+','+parseInt(tc.slice(3,5),16)+','+parseInt(tc.slice(5,7),16)+',0.12)')  :cb,color:isAct?tc:dg}}>{c.name}</button>
                )})}
              </div>
              {active && ap && (() => {
                const daysIn = Math.max(0, Math.floor((Date.now()-new Date(ap.start_date+'T00:00:00').getTime())/86400000))
                const wk = Math.max(1, Math.floor(daysIn/7)+1)
                const ssd = 30; const lp = Math.min(100, Math.round((daysIn/ssd)*100)); const il = lp >= 100
                const phases = (active.phases || []).slice().sort((a: any, b: any) => a.start_week - b.start_week)
                const currentPhase = phases.find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || phases[0]
                const isDue = !!dueCompounds.find((d: any) => d.id === active.id)
                const log = logs[active.id]; const taken = log?.taken || false; const dis = log?.discomfort || 0
                let vialDaysLeft = null; let vialDaysSince = null
                if (active.reconstitution_date) { const rd = new Date(active.reconstitution_date+'T00:00:00'); vialDaysSince = Math.floor((Date.now()-rd.getTime())/86400000); vialDaysLeft = 28-vialDaysSince }
                return (
                  <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
                    <div style={{background:'var(--color-bg)',borderRadius:'6px',height:'22px',overflow:'hidden',position:'relative',marginBottom:'12px'}}>
                      <div style={{height:'100%',width:lp+'%',background:il?g:'linear-gradient(90deg, #6c63ff, #8b5cf6)',borderRadius:'6px'}} />
                      <span style={{position:'absolute',top:0,left:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',color:il?'var(--color-green-text)':'var(--color-text)',letterSpacing:'0.5px'}}>{il ? '✓ STEADY STATE' : 'Day '+daysIn+'/'+ssd+' · Protocol Loading ('+lp+'%)'}</span>
                    </div>
                    {vialDaysLeft !== null && vialDaysSince !== null && (
                      <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid '+bd,marginBottom:'8px'}}>
                        <span style={{fontSize:'12px',color:dg}}>Vial status</span>
                        <span style={{fontSize:'12px',fontWeight:'700',color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'#c4c4dd'}}>{vialDaysLeft>0?vialDaysLeft+'d left':'expired'} ({vialDaysSince}d old){active.bac_water_ml ? ' · '+active.bac_water_ml+'mL BAC' : ''}</span>
                      </div>
                    )}
                    <span style={{fontSize:'10px',color:dg,fontWeight:'700',letterSpacing:'1px',display:'block',marginBottom:'6px'}}>PHASE TIMELINE</span>
                    {phases.map((ph: any, i: number) => {
                      const isCur = wk >= ph.start_week && wk <= ph.end_week
                      return (
                        <div key={ph.id||i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:i<phases.length-1?'1px solid '+bd:'none'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={{fontSize:'10px',fontWeight:'700',padding:'2px 7px',borderRadius:'4px',background:isCur?g:'rgba(255,255,255,0.08)',color:isCur?'var(--color-green-text)':dg}}>{ph.name||'P'+(i+1)}</span>
                            <div>
                              <span style={{fontSize:'13px',fontWeight:'600',color:isCur?'white':dg}}>{ph.dose}{ph.dose_unit}</span>
                              <span style={{fontSize:'11px',color:mg,display:'block'}}>W{ph.start_week}–W{ph.end_week} · {ph.frequency}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {isDue && (
                      <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid '+bd}}>
                        <span style={{fontSize:'10px',color:dg,fontWeight:'700',letterSpacing:'1px',display:'block',marginBottom:'8px'}}>TODAY'S DOSE</span>
                        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:taken?'10px':'0'}}>
                          <button onClick={() => toggleInjection(active.id)} style={{width:'26px',height:'26px',borderRadius:'6px',border:'1px solid '+(taken?g:bd),background:taken?g:'transparent',cursor:'pointer',color:'var(--color-green-text)',fontWeight:'800',padding:0}}>{taken ? '✓' : ''}</button>
                          <span style={{fontSize:'14px',fontWeight:'600',color:taken?dg:'white',textDecoration:taken?'line-through':'none'}}>{currentPhase?.dose}{currentPhase?.dose_unit} · {currentPhase?.frequency}</span>
                        </div>
                        {taken && <div><span style={{fontSize:'10px',color:mg,display:'block',marginBottom:'6px',letterSpacing:'1px'}}>DISCOMFORT (0 = none)</span><div style={{display:'flex',gap:'6px'}}>{[0,1,2,3,4,5].map(n => <DiscomfortBtn key={n} value={n} current={dis} onChange={v => setDiscomfortVal(active.id, v)} />)}</div></div>}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })()}

        {/* Event logger */}
        <div style={{marginBottom:'16px'}}>
          {!showAddEvent ? (
            <button onClick={() => setShowAddEvent(true)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'12px',cursor:'pointer',fontWeight:'600'}}>+ Log protocol change</button>
          ) : (
            <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>LOG PROTOCOL CHANGE</span>
              <select value={eventType} onChange={e => setEventType(e.target.value)} style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}>
                <option value='dose_change'>Dose changed</option>
                <option value='compound_added'>Added compound</option>
                <option value='compound_removed'>Stopped compound</option>
                <option value='phase_change'>Phase change</option>
                <option value='other'>Other</option>
              </select>
              <input value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder='e.g. Increased Reta to 5mg' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}} />
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => setShowAddEvent(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                <button onClick={saveEvent} disabled={!eventDesc.trim()} style={{flex:2,background:!eventDesc.trim()?'var(--color-green-20)':g,color:!eventDesc.trim()?'var(--color-muted)':'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>Log Event</button>
              </div>
            </div>
          )}
        </div>

        {/* Recent events */}
        {protocolEvents.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>PROTOCOL TIMELINE</span>
            {protocolEvents.slice(-5).reverse().map((ev: any, i: number) => (
              editingEventId === ev.id ? (
                <div key={ev.id} style={{padding:'10px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>
                  <select value={editEventType} onChange={e => setEditEventType(e.target.value)} style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'6px',color:'var(--color-text)',fontSize:'12px',boxSizing:'border-box',marginBottom:'6px'}}>
                    <option value='dose_change'>Dose changed</option>
                    <option value='compound_added'>Added compound</option>
                    <option value='compound_removed'>Stopped compound</option>
                    <option value='phase_change'>Phase change</option>
                    <option value='started'>Started</option>
                    <option value='other'>Other</option>
                  </select>
                  <input value={editEventDesc} onChange={e => setEditEventDesc(e.target.value)} style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'13px',boxSizing:'border-box',marginBottom:'6px'}} />
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={() => setEditingEventId(null)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'6px',fontSize:'12px',cursor:'pointer'}}>Cancel</button>
                    <button onClick={updateEvent} style={{flex:2,background:g,color:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'6px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save</button>
                  </div>
                </div>
              ) : (
                <div key={ev.id || i} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'8px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:eventColor(ev.event_type),marginTop:'4px',flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}><span style={{fontSize:'10px',color:'#0a0a0f',background:eventColor(ev.event_type),padding:'2px 6px',borderRadius:'4px',fontWeight:'700',textTransform:'uppercase'}}>{ev.event_type.replace(/_/g,' ')}</span><span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'600'}}>{ev.description}</span></div>
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

        {/* Daily log */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}><span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>DAILY LOG</span>{saved && <span style={{fontSize:'11px',color:g}}>✓ saved</span>}</div>
          <div style={{marginBottom:'12px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'12px',color:dg}}>Mood</span><div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={mood} onChange={setMood} />)}</div></div></div>
          <div style={{marginBottom:'12px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'12px',color:dg}}>Energy</span><div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={energy} onChange={setEnergy} activeColor='#f97316' />)}</div></div></div>
          <div style={{marginBottom:'12px'}}><div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}><span style={{fontSize:'12px',color:dg}}>Hunger</span><div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={hunger} onChange={setHunger} activeColor='#8b5cf6' />)}</div></div></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}><div><span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Sleep (hrs)</span><input type='number' step='0.5' value={sleep} onChange={e => setSleep(e.target.value)} placeholder='7.5' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}} /></div><div><span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Weight (lbs)</span><input type='number' step='0.1' value={weight} onChange={e => setWeight(e.target.value)} placeholder='optional' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}} /></div></div>
          <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder='Notes...' rows={2} style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'13px',boxSizing:'border-box',resize:'none',marginBottom:'12px'}} />
          <button onClick={saveEntry} disabled={saving} style={{width:'100%',background:saving?'var(--color-green-20)':g,color:saving?'var(--color-muted)':'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>{saving?'Saving...':saved?'Update':'Save'}</button>
        </div>






      </div>
    </main>
  )
}