'use client'

import StatsBoxes from '../../components/dashboard/StatsBoxes'
import CompoundRings from '../../components/dashboard/CompoundRings'
import CompactDailyLog from '../../components/dashboard/CompactDailyLog'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import WeeklySchedule from '../../components/dashboard/WeeklySchedule'
import WeeklySummary from '../../components/dashboard/WeeklySummary'
import HeroProtocolCard from '../../components/dashboard/HeroProtocolCard'
import { isDueToday } from '../../lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { type WeightUnit } from '../../lib/weightUtils'

type DueCompound = { id: string; name: string; dose: string; dose_unit: string; volume_ml: number; syringe_units: number; time_of_day: string; protocol_name: string; start_date?: string; frequency?: string; day_of_week?: number | null }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [entries, setEntries] = useState<any[]>([])
  const [activeProtocols, setActiveProtocols] = useState<any[]>([])
  const [logs, setLogs] = useState<Record<string, LogEntry>>({})
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [currentWeek, setCurrentWeek] = useState(0)
  const [showChart, setShowChart] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [activeCompoundTab, setActiveCompoundTab] = useState<string | null>(null)
  const [protocolEvents, setProtocolEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editEventDesc, setEditEventDesc] = useState('')
  const [editEventType, setEditEventType] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [hunger, setHunger] = useState<number | null>(null)
  const [sleep, setSleep] = useState('')
  const [weight, setWeight] = useState('')
  const [entryNotes, setEntryNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [missedDoses, setMissedDoses] = useState<string[]>([])
  const [showNewProtocol, setShowNewProtocol] = useState(false)
  const [newName, setNewName] = useState('')
  const [prefillDose, setPrefillDose] = useState('')
  const [prefillVial, setPrefillVial] = useState('')
  const [prefillWater, setPrefillWater] = useState('')
  const [creatingProtocol, setCreatingProtocol] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs')
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const mg = 'var(--color-muted)'
  const cb = 'var(--color-card)'
  const bd = 'var(--color-border)'

  useEffect(() => { loadAll() }, [])

  async function createProtocolFromCalc() {
    if (!newName.trim()) return
    setCreatingProtocol(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch('/api/create-protocol', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ name: newName.trim(), dose: prefillDose, vial: prefillVial, water: prefillWater }) 
    })
    if (res.ok) { 
      setCreateSuccess(true)
      setTimeout(() => { 
        setShowNewProtocol(false)
        setCreateSuccess(false)
        loadAll() 
      }, 1500) 
    }
    setCreatingProtocol(false)
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

  async function shareProtocol(protocolId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase.from('shared_protocols').select('token').eq('protocol_id', protocolId).eq('user_id', user.id).single()
    if (existing) {
      await navigator.clipboard.writeText(window.location.origin + '/share/' + existing.token)
      alert('Share link copied!')
      return
    }
    const { data: share } = await supabase.from('shared_protocols').insert({ protocol_id: protocolId, user_id: user.id }).select('token').single()
    if (share) {
      await navigator.clipboard.writeText(window.location.origin + '/share/' + share.token)
      alert('Share link copied!')
    }
  }

  async function loadAll() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      
      const { data: profile } = await supabase.from('user_profiles').select('weight_unit').eq('user_id', user.id).single()
      if (profile?.weight_unit) setWeightUnit(profile.weight_unit as WeightUnit)
      
      const { data: js } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })
      setEntries(js || [])
      
      const todayEntry = (js || []).find((e: any) => e.date === today)
      if (todayEntry) { 
        setMood(todayEntry.mood)
        setEnergy(todayEntry.energy)
        setSleep(todayEntry.sleep?.toString() || '')
        setWeight(todayEntry.weight?.toString() || '')
        setHunger(todayEntry.hunger ?? null)
        setEntryNotes(todayEntry.notes || '')
        setSaved(true) 
      }
      
      const { data: protocols } = await supabase.from('protocols').select('id, start_date, name, compounds(id, name, vial_strength, vial_unit, bac_water_ml, doses_taken_override, phases(dose, dose_unit, frequency, day_of_week, days_of_week, start_week, end_week, name, time_of_day))').eq('status', 'active')
      setActiveProtocols(protocols || [])
      
      if (protocols && protocols.length > 0) { 
        const earliest = protocols.reduce((m: string, p: any) => p.start_date < m ? p.start_date : m, protocols[0].start_date)
        setCurrentWeek(Math.max(1, Math.floor((Date.now() - new Date(earliest+'T00:00:00').getTime()) / 86400000 / 7) + 1)) 
      }
      
      const { data: ls } = await supabase.from('injection_logs').select('*').eq('date', today)
      const { data: allLogsData } = await supabase.from('injection_logs').select('compound_id, taken, date').eq('taken', true)
      setAllLogs(allLogsData || [])
      
      const map: Record<string, LogEntry> = {}
      ;(ls || []).forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } })
      setLogs(map)
      
      const { data: events } = await supabase.from('protocol_events').select('*').order('date', { ascending: true })
      setProtocolEvents(events || [])
      
      setLoading(false)
    } catch (err) {
      console.error('loadAll failed:', err)
      setLoading(false)
    }
  }

  async function toggleWeightUnit() {
    const newUnit: WeightUnit = weightUnit === 'lbs' ? 'kg' : 'lbs'
    setWeightUnit(newUnit)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').update({ weight_unit: newUnit }).eq('user_id', user.id)
    }
  }

  async function saveEntry() { 
    try { navigator.vibrate(6) } catch(e) {} 
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const row: any = { user_id: user.id, date: today, notes: entryNotes.trim() }
    if (mood !== null) row.mood = mood
    if (energy !== null) row.energy = energy
    if (sleep) row.sleep = parseFloat(sleep)
    if (weight) row.weight = parseFloat(weight)
    if (hunger !== null) row.hunger = hunger
    await supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,date' })
    setSaving(false)
    setSaved(true)
    loadAll() 
  }

  function eventColor(type: string) { 
    return type==='started'?g:type==='dose_change'?'#f59e0b':type==='compound_added'?'#06b6d4':type==='compound_removed'?'#ff6b6b':'#6c63ff' 
  }

  const we = entries.filter((e: any) => e.weight).sort((a: any, b: any) => a.date.localeCompare(b.date))
  const sw = we[0]?.weight
  const lw = we[we.length-1]?.weight
  const tl = (sw && lw) ? (sw - lw).toFixed(1) : null
  const cd = entries.slice().sort((a: any, b: any) => a.date.localeCompare(b.date)).map((e: any) => ({ 
    date: new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}), 
    mood: e.mood, 
    energy: e.energy, 
    sleep: e.sleep, 
    weight: e.weight 
  }))
  const ts = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }
  const mk: { date: string; label: string }[] = []
  activeProtocols.forEach((p: any) => { 
    const sl = new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
    ;(p.compounds||[]).forEach((c: any) => { mk.push({ date: sl, label: c.name }) }) 
  })
  protocolEvents.forEach((ev: any) => { 
    const evDate = new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
    mk.push({ date: evDate, label: ev.description }) 
  })

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  if (!loading && activeProtocols.length === 0) {
    return (
      <div style={{padding:'20px',textAlign:'center',paddingTop:'80px',minHeight:'100vh'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>??</div>
        <h2 style={{color:g,marginBottom:'12px',fontSize:'24px',fontWeight:'700'}}>Create Your First Protocol</h2>
        <p style={{color:dg,marginBottom:'32px'}}>Track your wellness journey.</p>
        <button onClick={() => setShowNewProtocol(true)} style={{background:g,color:'#000',padding:'16px 32px',borderRadius:'12px',fontWeight:'700',fontSize:'16px',border:'none',cursor:'pointer'}}>+ Create Protocol</button>
        {showNewProtocol && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}} onClick={(e)=>{if(e.target===e.currentTarget)setShowNewProtocol(false)}}>
            <div style={{background:cb,border:'1px solid '+bd,borderRadius:'16px',padding:'24px',width:'90%',maxWidth:'400px'}}>
              <h3 style={{fontSize:'18px',fontWeight:'700',marginBottom:'16px',color:g}}>Quick Protocol</h3>
              <input placeholder='Protocol name' value={newName} onChange={e=>setNewName(e.target.value)} style={{width:'100%',padding:'12px',marginBottom:'12px',background:'var(--color-surface)',border:'1px solid '+bd,borderRadius:'8px',color:'var(--color-text)'}}/>
              <button disabled={creatingProtocol||!newName.trim()} onClick={createProtocolFromCalc} style={{width:'100%',background:createSuccess?'#10b981':g,color:'#000',padding:'14px',borderRadius:'8px',fontWeight:'700',border:'none',cursor:creatingProtocol||!newName.trim()?'default':'pointer'}}>{createSuccess?'? Created!':creatingProtocol?'Creating...':'Create'}</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <main style={{minHeight:'100vh',paddingBottom:'100px'}}>
      <div style={{maxWidth:'600px',margin:'0 auto',padding:'16px'}}>
        <StatsBoxes currentWeight={lw ?? null} totalLost={tl ? Number(tl) : 0} weightStartDate={we[0]?.date ?? null} dueCompounds={[]} weightUnit={weightUnit} onToggleUnit={toggleWeightUnit} />
        <CompoundRings activeProtocols={activeProtocols} activeCompoundTab={activeCompoundTab} setActiveCompoundTab={setActiveCompoundTab} />
        <HeroProtocolCard activeProtocols={activeProtocols} activeCompoundTab={activeCompoundTab} logs={logs} allLogs={allLogs} totalLost={tl} compoundIndex={0} onShare={shareProtocol} />
        {(() => {
          const activeCompound = activeProtocols
            .flatMap((p: any) => (p.compounds || []).map((c: any) => ({ ...c, protocol_id: p.id, protocol_start: p.start_date })))
            .find((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))
          
          if (!activeCompound) return null

          const handleQuickLog = async () => {
            try { navigator.vibrate(10) } catch(e) {}
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            await supabase.from('injection_logs').upsert({ 
              user_id: user.id, 
              compound_id: activeCompound.id, 
              date: today, 
              taken: true, 
              discomfort: 0 
            }, { onConflict: 'user_id,compound_id,date' })
            const currentDoses = activeCompound.doses_taken_override || 0
            await supabase.from('compounds').update({ doses_taken_override: currentDoses + 1 }).eq('id', activeCompound.id)
            loadAll()
          }

          const handleQuickNewVial = async () => {
            if (!confirm(`Start a new vial of ${activeCompound.name}? This will reset doses taken to 0 and decrement your stock.`)) return
            const supabase = createClient()
            const currentStock = activeCompound.vials_in_stock || 1
            await supabase.from('compounds').update({
              vials_in_stock: Math.max(0, currentStock - 1),
              doses_taken_override: 0,
              reconstitution_date: today
            }).eq('id', activeCompound.id)
            loadAll()
          }

          const isLoggedToday = !!logs[activeCompound.id]?.taken

          return (
            <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
              <button 
                onClick={handleQuickLog}
                disabled={isLoggedToday}
                style={{
                  flex:2,
                  background: isLoggedToday ? 'var(--color-green-10)' : g,
                  color: isLoggedToday ? 'var(--color-green)' : 'var(--color-green-text)',
                  border: isLoggedToday ? '1px solid var(--color-green-30)' : 'none',
                  borderRadius:'8px',
                  padding:'12px',
                  fontSize:'14px',
                  fontWeight:'700',
                  cursor: isLoggedToday ? 'default' : 'pointer',
                  opacity: isLoggedToday ? 0.6 : 1
                }}
              >
                {isLoggedToday ? '? Logged Today' : '+ Log Shot'}
              </button>
              <button 
                onClick={handleQuickNewVial}
                style={{
                  flex:1,
                  background:'var(--color-card)',
                  color:dg,
                  border:'1px solid '+bd,
                  borderRadius:'8px',
                  padding:'12px',
                  fontSize:'13px',
                  fontWeight:'600',
                  cursor:'pointer'
                }}
              >
                New Vial
              </button>
              <button 
                onClick={() => window.location.href = '/protocol/manage'}
                style={{
                  flex:1,
                  background:'var(--color-card)',
                  color:dg,
                  border:'1px solid '+bd,
                  borderRadius:'8px',
                  padding:'12px',
                  fontSize:'13px',
                  fontWeight:'600',
                  cursor:'pointer'
                }}
              >
                Edit
              </button>
            </div>
          )
        })()}
        
        <WeeklySchedule activeProtocols={activeProtocols} />
        <CompactDailyLog mood={mood} energy={energy} hunger={hunger} sleep={sleep} weight={weight} notes={entryNotes} saving={saving} saved={saved} onMoodChange={setMood} onEnergyChange={setEnergy} onHungerChange={setHunger} onSleepChange={setSleep} onWeightChange={setWeight} onNotesChange={setEntryNotes} onSave={saveEntry} />
        <WeeklySummary entries={entries} currentWeek={currentWeek} show={showSummary} />
        {entries.length > 1 && (
          <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
            <button onClick={() => setShowChart(!showChart)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button>
            <button onClick={() => setShowSummary(!showSummary)} style={{flex:1,background:showSummary?'var(--color-green-10)':cb,color:showSummary?'var(--color-green)':dg,border:'1px solid '+(showSummary?'var(--color-green-30)':bd),borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>Week recap</button>
          </div>
        )}
        
        {showChart && cd.length > 1 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>MOOD, ENERGY & SLEEP</p>
            <ResponsiveContainer width='100%' height={140}>
              <LineChart data={cd}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...ts} />
                {mk.map((m, i) => (
                  <ReferenceLine 
                    key={'m1_'+i} 
                    x={m.date} 
                    stroke='#6c63ff' 
                    strokeDasharray='4 4' 
                    strokeOpacity={0.5} 
                    label={{
                      value: m.label, 
                      position: i % 2 === 0 ? 'insideTopRight' : 'insideBottomRight', 
                      fontSize: 10, 
                      fill: '#a78bfa', 
                      fontWeight: 700, 
                      offset: 8
                    }} 
                  />
                ))}
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />
                <Line type='monotone' dataKey='energy' stroke='#f97316' strokeWidth={2} dot={false} name='Energy' />
                <Line type='monotone' dataKey='sleep' stroke='#06b6d4' strokeWidth={2} dot={false} name='Sleep' />
              </LineChart>
            </ResponsiveContainer>
            {protocolEvents.length > 0 && (
              <div style={{marginTop:'8px',marginBottom:'8px',padding:'8px 0',borderTop:'1px solid '+bd}}>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:'9px',color:mg,fontWeight:'600',marginRight:'4px'}}>EVENTS</span>
                  {protocolEvents.map((ev: any, i: number) => (
                    <button 
                      key={ev.id||i} 
                      onClick={() => setSelectedEvent(selectedEvent?.id===ev.id?null:ev)} 
                      title={ev.description} 
                      style={{
                        width:'16px',
                        height:'16px',
                        borderRadius:'50%',
                        background:selectedEvent?.id===ev.id?eventColor(ev.event_type):'transparent',
                        border:'2px solid '+eventColor(ev.event_type),
                        cursor:'pointer',
                        padding:0
                      }}
                    />
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
                    <button onClick={() => setSelectedEvent(null)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>�</button>
                  </div>
                )}
              </div>
            )}
            {we.length > 1 && (
              <>
                <p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT</p>
                <ResponsiveContainer width='100%' height={100}>
                  <LineChart data={cd.filter((d: any) => d.weight)}>
                    <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                    <YAxis tick={{fontSize:10,fill:mg}} width={30} domain={['auto','auto']} />
                    <Tooltip {...ts} />
                    {mk.map((m, i) => (
                      <ReferenceLine key={'m2_'+i} x={m.date} stroke='#6c63ff' strokeDasharray='4 4' strokeOpacity={0.5} />
                    ))}
                    <Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name='Weight' />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        )}
        
      
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
                    <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
                      <span style={{fontSize:'10px',color:'#0a0a0f',background:eventColor(ev.event_type),padding:'2px 6px',borderRadius:'4px',fontWeight:'700',textTransform:'uppercase'}}>{ev.event_type.replace(/_/g,' ')}</span>
                      <span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'600'}}>{ev.description}</span>
                    </div>
                    <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginTop:'2px'}}>{new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  </div>
                  <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                    <button onClick={() => startEditEvent(ev)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'11px'}}>Edit</button>
                    <button onClick={() => deleteEvent(ev.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'11px'}}>�</button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
        </div>
    </main>
  )
}