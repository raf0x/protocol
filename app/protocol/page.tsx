'use client'
import { dosingDisplay, administrationForPhase } from '../../lib/health/dosingEntry'

import PlannedProtocols from '../../components/protocols/PlannedProtocols'
import { useLocalCalendarDate } from '../../lib/health/useLocalCalendarDate'
import { localCalendarDate, protocolLifecycle } from '../../lib/health/protocolDates'
import { orderTodayDoses } from '../../lib/health/today'
import type { LibraryProtocol } from '../../lib/health/protocolPresentation'
import './manage/protocols.css'
import TodayOverview from '../../components/today/TodayOverview'
import TodayHeader from '../../components/today/TodayHeader'

import styles from './today-v2.module.css'
import CompoundRings from '../../components/dashboard/CompoundRings'
import DailyCheckIn from '../../components/today/DailyCheckIn'
import DailyCheckInPrompt from '../../components/today/DailyCheckInPrompt'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { markOnboardingSeen, onboardingEligible, onboardingSeen } from '../../lib/protocols/onboarding'
import { orderRingProtocols } from '../../lib/protocols/rings'
import { createClient } from '../../lib/supabase'
import StatsBar from '../../components/dashboard/StatsBar'
import WeeklySchedule from '../../components/dashboard/WeeklySchedule'
import HeroProtocolCard from '../../components/dashboard/HeroProtocolCard'
import { isDueToday, getDaysIn } from '../../lib/utils'
import { currentPhase as selectCurrentPhase } from '../../lib/health/dosing'
import type { PhaseRow } from '../../lib/health/timeline'
import { convertWeight, formatWeight, getWeightLabel, type WeightUnit } from '../../lib/weightUtils'

type DueCompound = { id: string; name: string; dose: string; dose_unit: string; volume_ml: number; syringe_units: number; time_of_day: string; protocol_name: string; start_date?: string; frequency?: string; day_of_week?: number | null }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

export default function DashboardPage() {
  const router = useRouter()
  const [doseSaveError, setDoseSaveError] = useState<string | null>(null)
  const doseSavePending = useRef(false)
  const [scoreError, setScoreError] = useState<Partial<Record<'mood' | 'energy' | 'hunger', string | null>>>({})
  const scorePending = useRef<Partial<Record<'mood' | 'energy' | 'hunger', boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [streakDays, setStreakDays] = useState(0)
  const [loadError, setLoadError] = useState(false)
  const [entries, setEntries] = useState<any[]>([])
  const [checkInOwnerId, setCheckInOwnerId] = useState<string | null>(null)
  const [checkInLoadedDate, setCheckInLoadedDate] = useState<string | null>(null)
  const [checkInRecordedDate, setCheckInRecordedDate] = useState<string | null>(null)
  const [plannedProtocols, setPlannedProtocols] = useState<LibraryProtocol[]>([])
  const [activeProtocols, setActiveProtocols] = useState<any[]>([])
  const [scheduledProtocols, setScheduledProtocols] = useState<LibraryProtocol[]>([])
  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])
  const [logs, setLogs] = useState<Record<string, LogEntry>>({})
  const [allLogs, setAllLogs] = useState<any[]>([])
  const [showProtocols, setShowProtocols] = useState(false)
  const [activeCompoundTab, setActiveCompoundTab] = useState<string | null>(null)
  const tabRowRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const scrollStartX = useRef(0)
  const [protocolEvents, setProtocolEvents] = useState<any[]>([])
  // Local calendar day, not UTC — toISOString() drifts a day off in the evening
  // (US timezones) or at any hour (positive-UTC-offset timezones). This value
  // keys every injection_logs/journal_entries read and write on this page, so
  // it must use the same local-date basis as isDueToday and the weekly schedule.
  const today = useLocalCalendarDate()
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
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('lbs')
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const cb = 'var(--color-card)'
  const bd = 'var(--color-border)'

  useEffect(() => {
    loadAll()
    const pending = localStorage.getItem('pendingProtocol')
    if (pending) {
      try {
        const p = JSON.parse(pending)
        const params = new URLSearchParams({new:'1',name:p.name || '',dose:String(p.dose ?? ''),dose_unit:p.dose_unit || '',vial:String(p.vial ?? ''),vial_unit:p.vial_unit || '',water:String(p.water ?? '')})
        window.location.assign('/protocol/manage?' + params.toString())
        localStorage.removeItem('pendingProtocol')
      } catch(e) { localStorage.removeItem('pendingProtocol') }
    }
    
    // FIX: Use silent refresh (no full-page loading flash) when doses are logged
    function handleDosesUpdate() { refreshProtocolsSilently() }
    window.addEventListener('doses_updated', handleDosesUpdate)
    return () => window.removeEventListener('doses_updated', handleDosesUpdate)
  }, [today])

  async function exportToCSV() {
    // Calendar-only values are recorded days, not UTC instants. Keep the
    // existing timestamp and injection-range semantics; only format CSV dates.
    function csvProtocolDate(value: string, week = 1) {
      const calendarOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
      const date = new Date(calendarOnly ? value + 'T00:00:00' : value)
      if (calendarOnly) date.setDate(date.getDate() + (week - 1) * 7)
      else date.setTime(date.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000)
      return date.toLocaleDateString('en-US')
    }
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
      // This export describes dated treatment history, not unstarted inventory.
      if (['planned', 'scheduled'].includes(protocolLifecycle(protocol, localCalendarDate()) || '')) continue
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
            csvProtocolDate(protocol.start_date),
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
              csvProtocolDate(protocol.start_date, phase.start_week || 1),
              phase.end_week ? csvProtocolDate(protocol.start_date, phase.end_week) : phaseEnd.toLocaleDateString('en-US'),
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
    link.download = `protocol-export-${new Date().toLocaleDateString('en-CA')}.csv`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1_000)
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
    setCheckInOwnerId(user.id)
    
    // Only getUser() is a real dependency for the rest (they all need user.id via
    // the session, not a value from each other). Run the independent queries
    // concurrently. allSettled (not all) so one failed query never blanks out the
    // setters for the others that already succeeded.
    const [profileResult, journalResult, protocolsResult, logsResult, allLogsResult, eventsResult, plannedResult, ownershipResult] = await Promise.allSettled([
      supabase.from('user_profiles').select('weight_unit').eq('id', user.id).single(),
      supabase.from('journal_entries').select('*').order('date', { ascending: false }),
      supabase.from('protocols').select('id, created_at, status, start_date, name, notes, compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, doses_taken_override, ml_per_dose, vials_in_stock, notes, phases(id, dosing_entry, dose_semantics_version, injection_volume_ml, syringe_units, syringe_scale, route, dose, dose_unit, frequency, day_of_week, days_of_week, start_week, end_week, name, time_of_day))').eq('status', 'active'),
      supabase.from('injection_logs').select('*').eq('date', today),
      supabase.from('injection_logs').select('compound_id, taken, date').eq('taken', true),
      supabase.from('protocol_events').select('*').order('date', { ascending: true }),
      supabase.from('protocols').select('id,name,status,start_date,compounds(id,name)').eq('status', 'planned'),
      supabase.from('protocols').select('id').eq('user_id', user.id).limit(1),
    ])

    const owned = ownershipResult.status === 'fulfilled' && !ownershipResult.value.error ? ownershipResult.value.data : null
    if (onboardingEligible(user.id, owned) && !onboardingSeen(user.id)) {
      markOnboardingSeen(user.id)
      router.replace('/protocol/manage?new=1&onboarding=1')
      return
    }

    setPlannedProtocols(plannedResult.status === 'fulfilled' ? plannedResult.value.data || [] : [])
    const profile = profileResult.status === 'fulfilled' ? profileResult.value.data : null
    if (profile?.weight_unit) setWeightUnit(profile.weight_unit as WeightUnit)

    const js = journalResult.status === 'fulfilled' ? journalResult.value.data : null
    const journalError = journalResult.status === 'rejected' || !!journalResult.value.error
    setEntries(js || [])
    setCheckInLoadedDate(journalError ? null : today)
    let streak = 0
    const today2 = new Date(); today2.setHours(0,0,0,0)
    for (let i = 0; i < 365; i++) {
      const d = new Date(today2); d.setDate(d.getDate() - i)
      const ds = d.toLocaleDateString('en-CA')
      if ((js || []).find((e: any) => e.date === ds)) { streak++ } else { break }
    }
    setStreakDays(streak)
    const todayEntry = (js || []).find((e: any) => e.date === today)
    if (todayEntry) { setMood(todayEntry.mood); setEnergy(todayEntry.energy); setHunger(todayEntry.hunger ?? null); setEntryNotes(todayEntry.notes || ''); setSaved(true) }
    // Sleep and weight pre-fill from today's own entry when present, otherwise the
    // most recent prior entry that logged that field — a starting point to confirm
    // or adjust, not a blank field. js is already newest-first.
    const latestSleep = (js || []).find((e: any) => e.sleep !== null && e.sleep !== undefined)?.sleep
    setSleep(latestSleep != null ? latestSleep.toString() : '')
    const displayUnit: WeightUnit = (profile?.weight_unit as WeightUnit) || weightUnit
    const latestWeight = (js || []).find((e: any) => e.weight !== null && e.weight !== undefined)?.weight
    setWeight(latestWeight != null ? formatWeight(convertWeight(latestWeight, 'lbs', displayUnit), displayUnit) : '')

    const configured = protocolsResult.status === 'fulfilled' ? protocolsResult.value.data || [] : []
    const protocols = orderRingProtocols(configured.filter((p: {start_date:string}) => p.start_date && p.start_date <= localCalendarDate()))
    setScheduledProtocols(configured.filter((p: {start_date:string}) => p.start_date > localCalendarDate()))
    const protocolsError = protocolsResult.status === 'rejected' || !!protocolsResult.value.error

    setActiveProtocols(protocols || [])
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
    setDueCompounds(orderTodayDoses(due))
    const ls = logsResult.status === 'fulfilled' ? logsResult.value.data : null
    const logsError = logsResult.status === 'rejected' || !!logsResult.value.error
    const allLogsData = allLogsResult.status === 'fulfilled' ? allLogsResult.value.data : null
    setAllLogs(allLogsData || [])
    const map: Record<string, LogEntry> = {}; (ls || []).forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } }); setLogs(map)
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value.data : null
    const eventsError = eventsResult.status === 'rejected' || !!eventsResult.value.error
    setProtocolEvents((events || []).filter((event: {date:string}) => event.date <= localCalendarDate()))
    if (journalError || protocolsError || logsError || eventsError || plannedResult.status === 'rejected' || plannedResult.value.error) setLoadError(true)
    const hour = new Date().getHours()
    if (hour >= 20) {
      const logMap: Record<string, boolean> = {}
      ;(ls || []).forEach((l: any) => { if (l.taken) logMap[l.compound_id] = true })
      const missed = due.filter((c: any) => !logMap[c.id]).map((c: any) => c.name)
      setMissedDoses(missed)
    } else setMissedDoses([])
    setLoading(false)
    } catch {
      setLoadError(true)
      setLoading(false)
    }
  }

  // Single write path for every dose log surface (today's focus card and the
  // weekly schedule table) so they always agree on what has been logged.
  async function toggleInjection(cid: string, dateStr: string = today) {
    if (doseSavePending.current) return
    doseSavePending.current = true
    const isToday = dateStr === today
    if (isToday) setTogglingId(cid)
    setDoseSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in again to save this dose.')
      const cur = isToday ? logs[cid] : undefined
      const wasTaken = isToday ? !!cur?.taken : allLogs.some(log => log.compound_id === cid && log.date === dateStr && log.taken)
      const taken = !wasTaken
      const { error } = await supabase.from('injection_logs').upsert({
        user_id: user.id, compound_id: cid, date: dateStr, taken, discomfort: cur?.discomfort || 0
      }, { onConflict: 'user_id,compound_id,date' })
      if (error) throw error
      if (isToday) setLogs(previous => ({ ...previous, [cid]: { compound_id: cid, taken, discomfort: cur?.discomfort || 0 } }))
      setAllLogs(previous => [...previous.filter(log => !(log.compound_id === cid && log.date === dateStr)), ...(taken ? [{ compound_id: cid, date: dateStr, taken }] : [])])
      const { data: compound } = await supabase.from('compounds').select('doses_taken_override').eq('id', cid).single()
      const currentDoses = compound?.doses_taken_override ?? 0
      await supabase.from('compounds').update({ doses_taken_override: taken ? currentDoses + 1 : Math.max(0, currentDoses - 1) }).eq('id', cid)
      window.dispatchEvent(new Event('doses_updated'))
    } catch {
      setDoseSaveError('This dose wasn’t saved. Please check your connection and try again.')
    } finally {
      doseSavePending.current = false
      if (isToday) setTogglingId(null)
    }
  }
  async function setDiscomfortVal(cid: string, v: number) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: true, discomfort: v }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: true, discomfort: v } }) }
  // Mood/Energy/Hunger save instantly on tap via saveJournalField below. This
  // now only covers the secondary, typed fields that still need an explicit confirm.
  async function saveEntry() {
    try { navigator.vibrate(6) } catch(e) {}
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return false
      const row: any = { user_id: user.id, date: today, notes: entryNotes.trim() }
      if (sleep) row.sleep = parseFloat(sleep)
      if (weight) row.weight = convertWeight(parseFloat(weight), weightUnit, 'lbs')
      const { error } = await supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,date' })
      if (error) return false
      setSaved(true)
      loadAll()
      return true
    } catch {
      return false
    } finally {
      setSaving(false)
    }
  }

  // Single-tap save for Mood/Energy/Hunger: a partial upsert touching only that
  // column, so it can never clobber Sleep/Weight/Notes. Optimistic update with a
  // per-field pending lock and revert-on-failure, same spirit as toggleInjection.
  async function saveJournalField(field: 'mood' | 'energy' | 'hunger', value: number) {
    if (scorePending.current[field]) return
    scorePending.current[field] = true
    setScoreError(previous => ({ ...previous, [field]: null }))
    const previousValue = field === 'mood' ? mood : field === 'energy' ? energy : hunger
    const setValue = field === 'mood' ? setMood : field === 'energy' ? setEnergy : setHunger
    setValue(value)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in again to save this.')
      const { error } = await supabase.from('journal_entries').upsert({ user_id: user.id, date: today, [field]: value }, { onConflict: 'user_id,date' })
      if (error) throw error
      setSaved(true)
      setCheckInRecordedDate(today)
    } catch {
      setValue(previousValue)
      setScoreError(previous => ({ ...previous, [field]: 'Not saved. Try again.' }))
    } finally {
      scorePending.current[field] = false
    }
  }

  async function toggleWeightUnit() {
    const previousUnit = weightUnit
    const previousWeight = weight
    const newUnit: WeightUnit = previousUnit === 'lbs' ? 'kg' : 'lbs'
    setWeight(draft => draft.trim() !== '' && Number.isFinite(Number(draft))
      ? formatWeight(convertWeight(Number(draft), previousUnit, newUnit), newUnit)
      : draft)
    setWeightUnit(newUnit)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Sign in again to save this.')
      const { data, error } = await supabase.from('user_profiles')
        .upsert({ id: user.id, weight_unit: newUnit }, { onConflict: 'id' })
        .select('weight_unit')
        .single()
      if (error || data?.weight_unit !== newUnit) throw error ?? new Error('Weight unit was not persisted')
    } catch {
      setWeightUnit(previousUnit)
      setWeight(previousWeight)
    }
  }
  
  function ScoreBtn({ value, current, onChange, reverse }: { value: number; current: number | null; onChange: (v: number) => void; reverse?: boolean }) { const a = current === value; const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']; const reverseColors = ['#22c55e','#84cc16','#eab308','#f97316','#ef4444']; const sc = (reverse ? reverseColors : scoreColors)[value-1]; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?sc:cb,color:a?'#fff':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:a?1:0.5}}>{value}</button> }
  function DiscomfortBtn({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) { const a = current === value; const c = value === 0 ? g : '#ff6b6b'; return <button onClick={() => onChange(value)} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid '+(a?c:bd),background:a?(value===0?'var(--color-green-15)':'rgba(255,107,107,0.15)'):'transparent',color:a?c:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>{value}</button> }
  const hasDemoCompounds = activeProtocols.some((p: any) => p.name.startsWith('Demo:'))
  const we = entries.filter((e: any) => e.weight).sort((a: any, b: any) => a.date.localeCompare(b.date))
  const sw = we[0]?.weight; const lw = we[we.length-1]?.weight
  const tl = (sw && lw) ? (sw - lw).toFixed(1) : null
  function selectCompound(id: string) {
    setActiveCompoundTab(id)
  }

  if (loading) return <main className={`today-main ${styles.page}`}><div className={styles.container}><TodayHeader date={today} /><div className="today-card today-loading" role="status">Loading your day…</div></div></main>

  if (loadError) return <main className={`today-main ${styles.page}`}><div className={styles.container}><TodayHeader date={today} /><div className="today-card today-error" role="alert">Your day couldn’t be loaded. Your saved data hasn’t changed.<br /><button className="today-text-link" onClick={() => loadAll()}>Try again</button></div></div></main>


  return (
    <main className={`today-main ${styles.page}`}>
      <div className={styles.container}>
        <TodayOverview
          date={today} protocols={activeProtocols} events={protocolEvents} entries={entries}
          due={dueCompounds} logs={logs} saving={togglingId !== null} onTaken={toggleInjection}
          error={doseSaveError} selected={activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id || null}
          weightUnit={weightUnit} onToggleUnit={toggleWeightUnit} onSelect={selectCompound}
          onExportCSV={exportToCSV}
          warning={missedDoses.length > 0 && (
            <div className={`${styles.notice} ${styles.warningNotice}`}>
              <div>
                <strong>You may have missed a dose today</strong>
                <p>{missedDoses.join(', ')} {missedDoses.length === 1 ? 'was' : 'were'} due but not logged. Review Today’s focus or Schedule / logs.</p>
              </div>
            </div>
          )}
          rings={<CompoundRings activeProtocols={activeProtocols} activeCompoundTab={activeCompoundTab} setActiveCompoundTab={selectCompound} />}
          detail={activeProtocols.length > 0 && <HeroProtocolCard
            snapshot
            activeProtocols={activeProtocols} activeCompoundTab={activeCompoundTab} logs={logs} allLogs={allLogs} totalLost={tl}
            compoundIndex={activeProtocols.flatMap((p: any) => p.compounds || []).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
          />}
          schedule={<WeeklySchedule activeProtocols={activeProtocols} allLogs={allLogs} onToggle={toggleInjection} />}
          checkin={<DailyCheckInPrompt key={today} date={today} ownerId={checkInLoadedDate === today ? checkInOwnerId : null} recorded={checkInRecordedDate === today || entries.some(entry => entry.date === today)}>{dismiss => <DailyCheckIn
            today={today} entries={entries} mood={mood} energy={energy} hunger={hunger} sleep={sleep} weight={weight}
            notes={entryNotes} weightUnit={weightUnit} saving={saving} saved={saved} scoreError={scoreError}
            onScoreTap={saveJournalField} onSleepChange={setSleep} onWeightChange={setWeight} onNotesChange={setEntryNotes} onSave={saveEntry} onSaved={dismiss}
          />}</DailyCheckInPrompt>}
        />

        <PlannedProtocols protocols={plannedProtocols} onActivated={() => void loadAll(true)} />
        {!!scheduledProtocols.length && <section className="today-card"><h2>Scheduled protocols</h2>{scheduledProtocols.map(protocol => <p key={protocol.id}><a className="today-text-link" href={`/protocol/manage?protocol=${protocol.id}`}>{protocol.name}</a> · Starts {protocol.start_date}</p>)}</section>}

        {hasDemoCompounds && (
          <div className={styles.notice}>
            <div>
              <strong>These are sample protocols</strong>
              <p><a href="/protocol/manage" className="today-text-link">Manage protocols</a> to remove samples and add your own.</p>
            </div>
          </div>
        )}

      </div>
    </main>
  )
}
