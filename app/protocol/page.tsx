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
        <WeeklySchedule activeProtocols={activeProtocols} />
        <CompactDailyLog mood={mood} energy={energy} hunger={hunger} sleep={sleep} weight={weight} notes={entryNotes} saving={saving} saved={saved} onMoodChange={setMood} onEnergyChange={setEnergy} onHungerChange={setHunger} onSleepChange={setSleep} onWeightChange={setWeight} onNotesChange={setEntryNotes} onSave={saveEntry} />
        <WeeklySummary entries={entries} currentWeek={currentWeek} show={showSummary} />
      </div>
    </main>
  )
}