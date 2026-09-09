'use client'
import { dosingDisplay, administrationForPhase } from '../../lib/health/dosingEntry'

import TodayOverview from '../../components/today/TodayOverview'
import TodayHeader from '../../components/today/TodayHeader'

import StatsBoxes from '../../components/dashboard/StatsBoxes'
import CompoundRings from '../../components/dashboard/CompoundRings'
import CompactDailyLog from '../../components/dashboard/CompactDailyLog'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../lib/supabase'
import StatsBar from '../../components/dashboard/StatsBar'
import WeeklySchedule from '../../components/dashboard/WeeklySchedule'
import TodaysInjections from '../../components/dashboard/TodaysInjections'
import WeeklySummary from '../../components/dashboard/WeeklySummary'
import HeroProtocolCard from '../../components/dashboard/HeroProtocolCard'
import { isDueToday, getDaysIn, getCurrentWeek, eventColor } from '../../lib/utils'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { currentPhase as selectCurrentPhase } from '../../lib/health/dosing'
import type { PhaseRow } from '../../lib/health/timeline'
import { convertWeight, formatWeight, getWeightLabel, type WeightUnit } from '../../lib/weightUtils'

type DueCompound = { id: string; name: string; dose: string; dose_unit: string; volume_ml: number; syringe_units: number; time_of_day: string; protocol_name: string; start_date?: string; frequency?: string; day_of_week?: number | null }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

export default function DashboardPage() {
  const [heroOpen, setHeroOpen] = useState(false)
  const heroRef = useRef<HTMLDetailsElement>(null)
  const [doseSaveError, setDoseSaveError] = useState<string | null>(null)
  const doseSavePending = useRef(false)
  const [loading, setLoading] = useState(true)
  const [streakDays, setStreakDays] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [activeProtocols, setActiveProtocols] = useState<any[]>([])
  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])
  const [tomorrowCompounds, setTomorrowCompounds] = useState<DueCompound[]>([])
  const [logs, setLogs] = useState<Record<string, LogEntry>>({})
  const [allLogs, setAllLogs] = useState<any[]>([])
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
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [missedDoses, setMissedDoses] = useState<string[]>([])
  const [showNewProtocol, setShowNewProtocol] = useState(false)
  const [newName, setNewName] = useState('')
  const [quickDoseUnit, setQuickDoseUnit] = useState('mg')
  const [quickVialUnit, setQuickVialUnit] = useState('mg')
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

  useEffect(() => {
    loadAll()
    const pending = localStorage.getItem('pendingProtocol')
    if (pending) {
      try {
        const p = JSON.parse(pending)
        setNewName(p.name || '')
        setPrefillDose(p.dose?.toString() || '')
        setQuickDoseUnit(p.dose_unit || 'mg'); setQuickVialUnit(p.vial_unit || 'mg')
        setPrefillVial(p.vial?.toString() || '')
        setPrefillWater(p.water?.toString() || '')
        setShowNewProtocol(true)
        localStorage.removeItem('pendingProtocol')
      } catch(e) { localStorage.removeItem('pendingProtocol') }
    }
    
    // FIX: Use silent refresh (no full-page loading flash) when doses are logged
    function handleDosesUpdate() { refreshProtocolsSilently() }
    window.addEventListener('doses_updated', handleDosesUpdate)
    return () => window.removeEventListener('doses_updated', handleDosesUpdate)
  }, [])

  async function createProtocolFromCalc() {
    if (!newName.trim()) return
    setCreatingProtocol(true)
    try {
      const response = await fetch('/api/create-protocol', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({
        name:newName.trim(), dose:prefillDose, dose_unit:quickDoseUnit,
        vial:prefillVial, vial_unit:quickVialUnit, water:prefillWater,
      }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to create protocol')
    } catch (error) { alert(error instanceof Error ? error.message : 'Unable to create protocol'); setCreatingProtocol(false); return }
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
    setEventDesc('')
    setShowAddEvent(false)
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

  async function exportToCSV() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch all protocols with compounds, phases, and injection logs
    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('id, name, start_date, status, compounds(id, name, vial_strength, vial_unit, bac_water_ml, ml_per_dose, notes, phases(id, dosing_entry, dose_semantics_version, injection_volume_ml, syringe_units, syringe_scale, route, dose, dose_unit, frequency, start_week, end_week, duration_weeks), injection_logs(date, taken))')
      .eq('user_id', user.id)

    if (!allProtocols || allProtocols.length === 0) {
      alert('No protocols to export')
      return
    }

    let csvContent = 'Protocol Name,Compound Name,Dose,Dose Unit,Frequency,Start Date,End Date,Total Injections,Vials Used,mL per Injection\n'

    for (const protocol of allProtocols) {
      const compounds = protocol.compounds || []
      
      for (const compound of compounds) {
        const phases = compound.phases || []
        const injectionLogs = compound.injection_logs || []
        const mlPerDose = compound.ml_per_dose || 0
        const vialStrength = compound.vial_strength || 0
        
        if (phases.length === 0) {
          // No phases, just add compound row
          const totalInjections = injectionLogs.length
          const vialsUsed = vialStrength > 0 ? ((totalInjections * mlPerDose) / vialStrength).toFixed(2) : 0
          
          const row = [
            `"${protocol.name}"`,
            `"${compound.name}"`,
            '-',
            '-',
            '-',
            new Date(protocol.start_date).toLocaleDateString('en-US'),
            '-',
            totalInjections,
            vialsUsed,
            mlPerDose
          ].join(',')
          csvContent += row + '\n'
        } else {
          // Multiple phases (dose increases)
          for (const phase of phases) {
            const phaseStart = phase.start_week ? new Date(new Date(protocol.start_date).getTime() + (phase.start_week - 1) * 7 * 24 * 60 * 60 * 1000) : new Date(protocol.start_date)
            const phaseEnd = phase.end_week ? new Date(new Date(protocol.start_date).getTime() + (phase.end_week - 1) * 7 * 24 * 60 * 60 * 1000) : new Date()
            
            // Count injections in this phase
            const phaseInjections = injectionLogs.filter((log: any) => {
              const logDate = new Date(log.date)
              return logDate >= phaseStart && logDate <= phaseEnd && log.taken
            })
            
            const totalInjections = phaseInjections.length
            const vialsUsed = vialStrength > 0 ? ((totalInjections * mlPerDose) / vialStrength).toFixed(2) : 0
            
            const row = [
              `"${protocol.name}"`,
              `"${compound.name}"`,
              phase.dosing_entry ? dosingDisplay(phase).medication?.value ?? '' : phase.dose,
              phase.dosing_entry ? dosingDisplay(phase).medication?.unit ?? 'Uncalculated' : phase.dose_unit || '-',
              phase.frequency || '-',
              phaseStart.toLocaleDateString('en-US'),
              phaseEnd.toLocaleDateString('en-US'),
              totalInjections,
              vialsUsed,
              mlPerDose
            ].join(',')
            csvContent += row + '\n'
          }
        }
      }
    }

    // Trigger download
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `protocol-export-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    window.URL.revokeObjectURL(url)
  }

  async function shareProtocol(protocolId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: existing } = await supabase
      .from('shared_protocols')
      .select('token')
      .eq('protocol_id', protocolId)
      .eq('user_id', user.id)
      .single()
    if (existing) {
      await navigator.clipboard.writeText(window.location.origin + '/share/' + existing.token)
      alert('Share link copied!')
      return
    }
    const { data: share } = await supabase
      .from('shared_protocols')
      .insert({ protocol_id: protocolId, user_id: user.id })
      .select('token')
      .single()
    if (share) {
      await navigator.clipboard.writeText(window.location.origin + '/share/' + share.token)
      alert('Share link copied!')
    }
  }

  // Refresh the same presentation data after existing hero-card actions.
  async function refreshProtocolsSilently() {
    await loadAll(true)
  }

  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    setLoadError(false)
    try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    
    const { data: profile } = await supabase.from('user_profiles').select('weight_unit').eq('user_id', user.id).single()
    if (profile?.weight_unit) setWeightUnit(profile.weight_unit as WeightUnit)
    
    const { data: js, error: journalError } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })
    setEntries(js || [])
    let streak = 0
    const today2 = new Date(); today2.setHours(0,0,0,0)
    for (let i = 0; i < 365; i++) {
      const d = new Date(today2); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      if ((js || []).find((e: any) => e.date === ds)) { streak++ } else { break }
    }
    setStreakDays(streak)
    const todayEntry = (js || []).find((e: any) => e.date === today)
    if (todayEntry) { setMood(todayEntry.mood); setEnergy(todayEntry.energy); setSleep(todayEntry.sleep?.toString() || ''); setWeight(todayEntry.weight?.toString() || ''); setHunger(todayEntry.hunger ?? null); setEntryNotes(todayEntry.notes || ''); setSaved(true) }
    
    const { data: protocols, error: protocolsError } = await supabase.from('protocols').select('id, start_date, name, notes, compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, doses_taken_override, ml_per_dose, vials_in_stock, notes, phases(id, dosing_entry, dose_semantics_version, injection_volume_ml, syringe_units, syringe_scale, route, dose, dose_unit, frequency, day_of_week, days_of_week, start_week, end_week, name, time_of_day))').eq('status', 'active')
    
    setActiveProtocols(protocols || [])
    if (protocols && protocols.length > 0) { const earliest = protocols.reduce((m: string, p: any) => p.start_date < m ? p.start_date : m, protocols[0].start_date); setCurrentWeek(Math.max(1, Math.floor((Date.now() - new Date(earliest+'T00:00:00').getTime()) / 86400000 / 7) + 1)) }
    const due: DueCompound[] = []
    ;(protocols || []).forEach((p: any) => { (p.compounds||[]).forEach((c: any) => { const phase = selectCurrentPhase(c.phases as PhaseRow[] || [], p.start_date, new Date().toLocaleDateString('en-CA')); if (phase && (phase.dosing_entry || phase.dose_semantics_version === 1) && isDueToday(phase.frequency || '', p.start_date, phase.day_of_week ?? null, undefined, phase.days_of_week ?? undefined)) {
          const volumeMl = administrationForPhase(phase).volume ?? 0
          const syringeUnits = administrationForPhase(phase).markings ?? 0
          due.push({
            id: c.id,
            name: c.name,
            dose: dosingDisplay(phase).primary,
            dose_unit: '',
            volume_ml: volumeMl,
            syringe_units: syringeUnits,
            time_of_day: phase.time_of_day || '',
            protocol_name: p.name
          })
        } }) })
    setDueCompounds(due)
      
    const tmr: DueCompound[] = []
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0]
    ;(protocols || []).forEach((p: any) => {
      ;(p.compounds||[]).forEach((c: any) => {
        const phase = selectCurrentPhase(c.phases as PhaseRow[] || [], p.start_date, tomorrowStr)
        if (phase && (phase.dosing_entry || phase.dose_semantics_version === 1) && isDueToday(phase.frequency || '', p.start_date, phase.day_of_week ?? null, tomorrowStr, phase.days_of_week ?? undefined)) {
          tmr.push({ id: c.id, name: c.name, dose: dosingDisplay(phase).primary, dose_unit: '', volume_ml: 0, syringe_units: 0, time_of_day: phase.time_of_day || '', protocol_name: p.name, start_date: p.start_date, frequency: phase.frequency || undefined, day_of_week: phase.day_of_week })
        }
      })
    })
    setTomorrowCompounds(tmr)
    const { data: ls, error: logsError } = await supabase.from('injection_logs').select('*').eq('date', today)
    const { data: allLogsData } = await supabase.from('injection_logs').select('compound_id, taken, date').eq('taken', true)
    setAllLogs(allLogsData || [])
    const map: Record<string, LogEntry> = {}; (ls || []).forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } }); setLogs(map)
    const { data: events, error: eventsError } = await supabase.from('protocol_events').select('*').order('date', { ascending: true })
    setProtocolEvents(events || [])
    if (journalError || protocolsError || logsError || eventsError) setLoadError(true)
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

  async function toggleInjection(cid: string) {
    if (doseSavePending.current) return
    doseSavePending.current = true
    setTogglingId(cid)
    setDoseSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in again to save this dose.')
      const cur = logs[cid]
      const taken = !cur?.taken
      const { error } = await supabase.from('injection_logs').upsert({
        user_id: user.id, compound_id: cid, date: today, taken, discomfort: cur?.discomfort || 0
      }, { onConflict: 'user_id,compound_id,date' })
      if (error) throw error
      setLogs(previous => ({ ...previous, [cid]: { compound_id: cid, taken, discomfort: cur?.discomfort || 0 } }))
      setAllLogs(previous => [...previous.filter(log => !(log.compound_id === cid && log.date === today)), ...(taken ? [{ compound_id: cid, date: today, taken }] : [])])
    } catch {
      setDoseSaveError('This dose wasn’t saved. Please check your connection and try again.')
    } finally {
      doseSavePending.current = false
      setTogglingId(null)
    }
  }
  async function setDiscomfortVal(cid: string, v: number) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: true, discomfort: v }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: true, discomfort: v } }) }
  async function saveEntry() { try { navigator.vibrate(6) } catch(e) {} setSaving(true); const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setSaving(false); return }; const row: any = { user_id: user.id, date: today, notes: entryNotes.trim() }; if (mood !== null) row.mood = mood; if (energy !== null) row.energy = energy; if (sleep) row.sleep = parseFloat(sleep); if (weight) row.weight = parseFloat(weight); if (hunger !== null) row.hunger = hunger; await supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,date' }); setSaving(false); setSaved(true); loadAll() }
  
  async function toggleWeightUnit() {
    const newUnit: WeightUnit = weightUnit === 'lbs' ? 'kg' : 'lbs'
    setWeightUnit(newUnit)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').update({ weight_unit: newUnit }).eq('user_id', user.id)
    }
  }
  
  function ScoreBtn({ value, current, onChange, reverse }: { value: number; current: number | null; onChange: (v: number) => void; reverse?: boolean }) { const a = current === value; const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']; const reverseColors = ['#22c55e','#84cc16','#eab308','#f97316','#ef4444']; const sc = (reverse ? reverseColors : scoreColors)[value-1]; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?sc:cb,color:a?'#fff':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:a?1:0.5}}>{value}</button> }
  function DiscomfortBtn({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) { const a = current === value; const c = value === 0 ? g : '#ff6b6b'; return <button onClick={() => onChange(value)} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid '+(a?c:bd),background:a?(value===0?'var(--color-green-15)':'rgba(255,107,107,0.15)'):'transparent',color:a?c:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>{value}</button> }

  function eventColor(type: string) { return type==='started'?g:type==='dose_change'?'#f59e0b':type==='compound_added'?'#06b6d4':type==='compound_removed'?'#ff6b6b':'#6c63ff' }

  const hasDemoCompounds = activeProtocols.some((p: any) => p.name.startsWith('Demo:'))
  const we = entries.filter((e: any) => e.weight).sort((a: any, b: any) => a.date.localeCompare(b.date))
  const sw = we[0]?.weight; const lw = we[we.length-1]?.weight
  const tl = (sw && lw) ? (sw - lw).toFixed(1) : null
  const cd = entries.slice().sort((a: any, b: any) => a.date.localeCompare(b.date)).map((e: any) => ({ date: new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}), mood: e.mood, energy: e.energy, sleep: e.sleep, weight: e.weight }))
  const ts = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }
  const mk: { date: string; label: string }[] = []
  activeProtocols.forEach((p: any) => { const sl = new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); (p.compounds||[]).forEach((c: any) => { mk.push({ date: sl, label: c.name }) }) })
  protocolEvents.forEach((ev: any) => { const evDate = new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); mk.push({ date: evDate, label: ev.description }) })

  const ins: { text: string; accent: string }[] = []
  
  if (we.length >= 2) {
    const diff = sw! - lw!
    const db = Math.max(1, Math.floor((new Date(we[we.length-1].date).getTime() - new Date(we[0].date).getTime()) / 86400000))
    const wb = Math.max(1, db/7)
    if (diff > 0) {
      ins.push({ text: `Weight change: down ${diff.toFixed(1)} lbs since you started`, accent: g })
      if (wb >= 2) {
        const wr = diff/wb
        ins.push({ text: `Average: ${wr.toFixed(1)} lbs per week over ${wb.toFixed(0)} weeks`, accent: g })
      }
    }
  }
  
  if (entries.length >= 5) {
    const me = entries.filter((e: any) => e.mood !== null)
    if (me.length >= 3) {
      const am = me.reduce((s: number, e: any) => s+e.mood, 0)/me.length
      ins.push({ text: `Mood: averaging ${am.toFixed(1)}/5 over ${me.length} entries`, accent: g })
    }
    
    const rw = entries.slice(0,7).filter((e: any) => e.sleep !== null)
    if (rw.length >= 3) {
      const as2 = rw.reduce((s: number, e: any) => s+e.sleep, 0)/rw.length
      ins.push({ text: `Sleep: ${as2.toFixed(1)} hours average this week`, accent: '#06b6d4' })
    }
  }
  
  const he = entries.filter((e: any) => e.hunger !== null && e.hunger !== undefined)
  if (he.length >= 3) {
    const ah = he.reduce((s: number, e: any) => s+e.hunger, 0)/he.length
    ins.push({ text: `Appetite: ${ah.toFixed(1)}/5 average over ${he.length} entries`, accent: '#8b5cf6' })
  }
  
  if (currentWeek > 0) {
    ins.push({ text: `Week ${currentWeek} · ${entries.length} total journal entries logged`, accent: '#6c63ff' })
  }
  
  const vi = ins.slice(0, 3)

  function selectCompound(id: string) {
    setActiveCompoundTab(id)
    setHeroOpen(true)
    requestAnimationFrame(() => heroRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' }))
  }

  if (loading) return <main className="today-main"><div className="today-container"><TodayHeader date={today} /><div className="today-card today-loading" role="status">Loading your day…</div></div></main>

  if (loadError) return <main className="today-main"><div className="today-container"><TodayHeader date={today} /><div className="today-card today-error" role="alert">Your day couldn’t be loaded. Your saved data hasn’t changed.<br /><button className="today-text-link" onClick={() => loadAll()}>Try again</button></div></div></main>


  return (
    <main className="today-main">
      <div className="today-container">
        <TodayOverview
          date={today} protocols={activeProtocols} events={protocolEvents} entries={entries}
          due={dueCompounds} logs={logs} saving={togglingId !== null} onTaken={toggleInjection}
          error={doseSaveError} selected={heroOpen ? (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id) : null}
          onSelect={selectCompound} weightUnit={weightUnit} onToggleUnit={toggleWeightUnit}
          rings={<CompoundRings activeProtocols={activeProtocols} activeCompoundTab={activeCompoundTab} setActiveCompoundTab={selectCompound} />}
          detail={activeProtocols.length > 0 && <details id="today-protocol-detail" ref={heroRef} className="today-hero-detail" open={heroOpen} onToggle={event => setHeroOpen(event.currentTarget.open)}>
            <summary>Protocol details <span>Schedule, inventory & sharing</span></summary>
            <HeroProtocolCard
              activeProtocols={activeProtocols} activeCompoundTab={activeCompoundTab} logs={logs} allLogs={allLogs} totalLost={tl}
              compoundIndex={activeProtocols.flatMap((p: any) => p.compounds || []).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
              onShare={shareProtocol}
            />
          </details>}
        />
        <details className="today-dashboard-tools">
          <summary>Dashboard tools <span>Daily log, weekly schedule, charts & export</span></summary>
          <TodaysInjections dueCompounds={dueCompounds} tomorrowCompounds={tomorrowCompounds} logs={logs} onToggle={toggleInjection} />
        {hasDemoCompounds && (
          <div style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.2)',borderRadius:'12px',padding:'14px 16px',marginBottom:'16px',display:'flex',alignItems:'flex-start',gap:'10px'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>👋</span>
            <div>
              <span style={{fontSize:'12px',fontWeight:'700',color:g,display:'block',marginBottom:'2px'}}>Delete these samples and create your real protocols</span>
              <span style={{fontSize:'12px',color:'var(--color-dim)'}}>These are demo compounds. Click on <a href="/protocol/manage" style={{color:g,fontWeight:'600',textDecoration:'none',borderBottom:'1px solid '+g}}>+ Add/Edit Protocol</a> to delete demo compounds and start tracking your stack.</span>
            </div>
          </div>
        )}

        {createSuccess && (
          <div style={{background:'var(--color-green-10)',border:'1px solid var(--color-green-30)',borderRadius:'12px',padding:'16px',marginBottom:'16px',textAlign:'center'}}>
            <span style={{color:g,fontSize:'14px',fontWeight:'700'}}>Protocol Created!</span>
            <p style={{fontSize:'12px',color:dg,marginTop:'4px'}}>It's now in your active stack below.</p>
          </div>
        )}

        {activeProtocols.length > 0 && (
          <div style={{display:'flex',gap:'8px',marginBottom:'16px',justifyContent:'flex-end'}}>
            <button 
              onClick={exportToCSV}
              style={{background:'var(--color-card)',color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'8px 14px',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}
            >
              ↓ Export CSV
            </button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
          <StatsBoxes
            currentWeight={lw ?? null}
            totalLost={tl ? Number(tl) : 0}
            weightStartDate={we[0]?.date ?? null}
            dueCompounds={dueCompounds.map(c => ({ id: c.id, name: c.name }))}
            weightUnit={weightUnit}
            onToggleUnit={toggleWeightUnit}
          />
          
        </div>

        {(() => {
          const activeCompound = activeProtocols
            .flatMap((p: any) => (p.compounds || []).map((c: any) => ({ ...c, protocol_id: p.id, protocol_start: p.start_date })))
            .find((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))
          
       if (!activeCompound) return null
        return (
          <>
            <WeeklySchedule activeProtocols={activeProtocols} />

        <CompactDailyLog
          mood={mood}
          energy={energy}
          hunger={hunger}
          sleep={sleep}
          weight={weight}
          notes={entryNotes}
          saving={saving}
          saved={saved}
          onMoodChange={setMood}
          onEnergyChange={setEnergy}
          onHungerChange={setHunger}
          onSleepChange={setSleep}
          onWeightChange={setWeight}
          onNotesChange={setEntryNotes}
          onSave={saveEntry}
        />

        <WeeklySummary entries={entries} currentWeek={currentWeek} show={showSummary} />

        {missedDoses.length > 0 && (
          <div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'12px',padding:'14px 16px',marginBottom:'16px',display:'flex',alignItems:'flex-start',gap:'10px'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>⚠️</span>
            <div>
              <span style={{fontSize:'12px',fontWeight:'700',color:'#f97316',display:'block',marginBottom:'2px'}}>Looks like you may have missed a dose today</span>
              <span style={{fontSize:'12px',color:'var(--color-dim)'}}>{missedDoses.join(', ')} {missedDoses.length === 1 ? 'was' : 'were'} due but not logged. Tap the compound tab to log it.</span>
            </div>
          </div>
        )}

        {entries.length > 1 && (
  <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
    <button onClick={() => setShowChart(!showChart)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button>
    <button onClick={() => setShowSummary(!showSummary)} style={{flex:1,background:showSummary?'var(--color-green-10)':cb,color:showSummary?'var(--color-green)':dg,border:'1px solid '+(showSummary?'var(--color-green-30)':bd),borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>Week recap</button>
  </div>
)}
          </>
        )
        })()}
        
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
                    <button onClick={() => setSelectedEvent(null)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>✕</button>
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
                    <button onClick={() => deleteEvent(ev.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'11px'}}>Delete</button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        <div style={{marginTop:'32px',paddingTop:'16px',borderTop:'1px solid '+bd,display:'flex',justifyContent:'center'}}>
          <a href='/protocol/manage' style={{color:g,textDecoration:'none',fontSize:'13px',fontWeight:'700',padding:'12px 24px',background:'var(--color-green-10)',border:'1px solid var(--color-green-30)',borderRadius:'8px',cursor:'pointer',display:'inline-block'}}>
            → My Protocols
          </a>
        </div>
        </details>
        {showNewProtocol && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:'20px'}} onClick={(e)=>{if(e.target===e.currentTarget)setShowNewProtocol(false)}}>
            <div style={{background:cb,border:'1px solid '+bd,borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'420px'}}>
              <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:g}}>Create Your Protocol</h3>
              <p style={{fontSize:'13px',color:dg,marginBottom:'20px'}}>Enter your compound details to get started</p>
              
              <div style={{marginBottom:'12px'}}>
                <label style={{fontSize:'12px',fontWeight:'600',color:'var(--color-text)',display:'block',marginBottom:'6px'}}>Compound Name</label>
                <input 
                  placeholder='e.g., Semaglutide' 
                  value={newName} 
                  onChange={e=>setNewName(e.target.value)} 
                  style={{width:'100%',padding:'12px',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}}
                />
              </div>
              
              <div style={{display:'flex',gap:12,marginBottom:12}}><label>Dose unit <select value={quickDoseUnit} onChange={e => setQuickDoseUnit(e.target.value)}>{['mg','mcg','IU'].map(u => <option key={u}>{u}</option>)}</select></label><label>Vial unit <select value={quickVialUnit} onChange={e => setQuickVialUnit(e.target.value)}>{['mg','mcg','IU'].map(u => <option key={u}>{u}</option>)}</select></label></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'20px'}}>
                <div>
                  <label style={{fontSize:'12px',fontWeight:'600',color:'var(--color-text)',display:'block',marginBottom:'6px'}}>Medication dose</label>
                  <input 
                    placeholder='Medication amount' 
                    value={prefillDose} 
                    onChange={e=>setPrefillDose(e.target.value)} 
                    style={{width:'100%',padding:'12px',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}}
                  />
                </div>
                <div>
                  <label style={{fontSize:'12px',fontWeight:'600',color:'var(--color-text)',display:'block',marginBottom:'6px'}}>Vial amount</label>
                  <input 
                    placeholder='5' 
                    value={prefillVial} 
                    onChange={e=>setPrefillVial(e.target.value)} 
                    style={{width:'100%',padding:'12px',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}}
                  />
                </div>
              </div>
              
              <div style={{marginBottom:'20px'}}>
                <label style={{fontSize:'12px',fontWeight:'600',color:'var(--color-text)',display:'block',marginBottom:'6px'}}>BAC Water (ml)</label>
                <input 
                  placeholder='2' 
                  value={prefillWater} 
                  onChange={e=>setPrefillWater(e.target.value)} 
                  style={{width:'100%',padding:'12px',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}}
                />
              </div>
              
              <div style={{display:'flex',gap:'10px'}}>
                <button 
                  onClick={() => setShowNewProtocol(false)} 
                  style={{flex:1,background:'transparent',color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'14px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}
                >
                  Cancel
                </button>
                <button 
                  disabled={creatingProtocol||!newName.trim()} 
                  onClick={createProtocolFromCalc} 
                  style={{flex:2,background:createSuccess?'#10b981':creatingProtocol?mg:g,color:createSuccess?'#fff':creatingProtocol?dg:'#000',padding:'14px',borderRadius:'8px',fontWeight:'700',border:'none',cursor:creatingProtocol||!newName.trim()?'not-allowed':'pointer',opacity:creatingProtocol||!newName.trim()?0.5:1}}
                >
                  {createSuccess?'✓ Created!':creatingProtocol?'Creating...':'Create Protocol'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
