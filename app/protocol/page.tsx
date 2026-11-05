'use client'
import { recordedDoseDisplay, recordedDoseCsvHeaders, recordedDoseCsvFields, csvRecordedCell } from '../../lib/health/recordedDose'

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

type DueCompound = { id: string; name: string; dose: string; dose_unit: string; volume_ml: string | null; syringe_units: string | null; time_of_day: string; protocol_name: string; start_date?: string; frequency?: string; day_of_week?: number | null }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }
type SecondarySection = 'health' | 'history' | 'planned'
type ReadStatus = 'loading' | 'ready' | 'error' | 'needs-unit'
const LOAD_DEADLINE_MS = 10_000

// Bound the caller even when authentication or a transport ignores cancellation.
function withLoadingDeadline<T>(controller: AbortController, work: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new Error('Loading interrupted'))
    const timer = setTimeout(() => {
      reject(new Error('Loading timed out'))
      controller.abort()
    }, LOAD_DEADLINE_MS)
    controller.signal.addEventListener('abort', aborted, { once: true })
    Promise.resolve().then(() => {
      if (controller.signal.aborted) throw new Error('Loading interrupted')
      return work()
    }).then(resolve, reject).finally(() => {
      clearTimeout(timer)
      controller.signal.removeEventListener('abort', aborted)
    })
    // Also clean up immediately if work never settles after cancellation.
    controller.signal.addEventListener('abort', () => clearTimeout(timer), { once: true })
  })
}

export default function DashboardPage() {
  const router = useRouter()
  const [doseSaveError, setDoseSaveError] = useState<string | null>(null)
  const doseSavePending = useRef(false)
  const [scoreError, setScoreError] = useState<Partial<Record<'mood' | 'energy' | 'hunger', string | null>>>({})
  const scorePending = useRef<Partial<Record<'mood' | 'energy' | 'hunger', boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [streakDays, setStreakDays] = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [signedOut, setSignedOut] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pendingSave, setPendingSave] = useState(false)
  const [needsWeightUnit, setNeedsWeightUnit] = useState(false)
  const [weightRecoveryPending, setWeightRecoveryPending] = useState(false)
  const [weightRecoveryError, setWeightRecoveryError] = useState<string | null>(null)
  const recoveryNeeded = useRef(false)
  const failedWeightRecovery = useRef(false)
  const [criticalDate, setCriticalDate] = useState<string | null>(null)
  const [secondary, setSecondary] = useState<Record<SecondarySection, ReadStatus>>({ health: 'loading', history: 'loading', planned: 'loading' })
  const [secondaryLoaded, setSecondaryLoaded] = useState<Record<SecondarySection, boolean>>({ health: false, history: false, planned: false })
  const mounted = useRef(false)
  const scopeVersion = useRef(0)
  const readVersion = useRef(0)
  const owner = useRef<string | null>(null)
  const authIdentity = useRef<string | null>(null)
  const criticalReady = useRef(false)
  const draftHydrated = useRef<string | null>(null)
  const controllers = useRef(new Set<AbortController>())
  const batch = useRef<Promise<void> | null>(null)
  const secondaryJobs = useRef<Partial<Record<SecondarySection, Promise<void>>>>({})
  const mutations = useRef(new Set<string>())
  const writeWaiters = useRef(new Set<() => void>())
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
    mounted.current = true
    resetScope()
    void loadAll()
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') { authIdentity.current = session?.user.id ?? null; return }
      if (event === 'SIGNED_OUT') {
        authIdentity.current = null
        resetScope()
        setSignedOut(true)
        setLoadError('Your session has ended. Sign in again to load your day.')
        setLoading(false)
      } else if (session?.user.id && session.user.id !== (owner.current || authIdentity.current)) {
        authIdentity.current = session.user.id
        resetScope()
        // Do not await another auth method inside Supabase's auth callback.
        queueMicrotask(() => { if (mounted.current) void loadAll() })
      }
    })
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
    return () => {
      mounted.current = false
      scopeVersion.current++
      cancelReads()
      subscription.unsubscribe()
      window.removeEventListener('doses_updated', handleDosesUpdate)
    }
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

    let csvContent = 'Protocol Name,Compound Name,Dose,Dose Unit,Frequency,Start Date,End Date,Total Injections,Vials Used,Legacy compound mL per injection (origin unverified),' + recordedDoseCsvHeaders.join(',') + '\n'

    for (const protocol of allProtocols) {
      // This export describes dated treatment history, not unstarted inventory.
      if (['planned', 'scheduled'].includes(protocolLifecycle(protocol, localCalendarDate()) || '')) continue
      const compounds = protocol.compounds || []
      
      for (const compound of compounds) {
        const phases = compound.phases || []
        const injectionLogs = compound.injection_logs || []
        const mlPerDose = compound.ml_per_dose ?? 'Unknown'
        
        if (phases.length === 0) {
          // No phases, just add compound row
          const totalInjections = injectionLogs.filter((log: any) => log.taken === true).length
          
          const row = [
            `"${protocol.name}"`,
            `"${compound.name}"`,
            '-',
            '-',
            '-',
            csvProtocolDate(protocol.start_date),
            '-',
            totalInjections,
            'Unknown', // Physical-vial usage is not established by injection logs.
            mlPerDose,

            ...recordedDoseCsvFields(null).map(csvRecordedCell)
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
              return logDate >= phaseStart && logDate <= phaseEnd && log.taken === true
            })
            
            const totalInjections = phaseInjections.length
            
            const row = [
              `"${protocol.name}"`,
              `"${compound.name}"`,
              csvRecordedCell(recordedDoseDisplay(phase).medication?.value),
              csvRecordedCell(recordedDoseDisplay(phase).medication?.unit),
              phase.frequency || '-',
              csvProtocolDate(protocol.start_date, phase.start_week || 1),
              phase.end_week ? csvProtocolDate(protocol.start_date, phase.end_week) : phaseEnd.toLocaleDateString('en-US'),
              totalInjections,
              'Unknown', // Physical-vial usage is not established by injection logs.
              mlPerDose,

              ...recordedDoseCsvFields(phase).map(csvRecordedCell)
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

  function cancelReads() {
    readVersion.current++
    controllers.current.forEach(controller => controller.abort())
    controllers.current.clear()
    batch.current = null
    secondaryJobs.current = {}
  }

  function resetScope() {
    scopeVersion.current++
    cancelReads()
    owner.current = null
    criticalReady.current = false
    draftHydrated.current = null
    mutations.current.clear()
    doseSavePending.current = false
    scorePending.current = {}
    setLoading(true)
    setRefreshing(false)
    setPendingSave(false)
    recoveryNeeded.current = false
    failedWeightRecovery.current = false
    setNeedsWeightUnit(false)
    setWeightRecoveryPending(false)
    setWeightRecoveryError(null)
    setLoadError(null)
    setSignedOut(false)
    setRedirecting(false)
    setCriticalDate(null)
    setSecondary({ health: 'loading', history: 'loading', planned: 'loading' })
    setSecondaryLoaded({ health: false, history: false, planned: false })
    setEntries([]); setAllLogs([]); setLogs({}); setDueCompounds([])
    setActiveProtocols([]); setScheduledProtocols([]); setPlannedProtocols([])
    setCheckInOwnerId(null); setCheckInLoadedDate(null); setCheckInRecordedDate(null)
    setMood(null); setEnergy(null); setHunger(null); setSleep(''); setWeight(''); setEntryNotes('')
    setWeightUnit('lbs'); setSaved(false); setSaving(false); setTogglingId(null)
    setDoseSaveError(null); setScoreError({}); setMissedDoses([]); setActiveCompoundTab(null)
  }

  function currentRead(version: number) {
    return mounted.current && readVersion.current === version
  }

  function waitForWrites(signal: AbortSignal): Promise<void> {
    if (!mutations.current.size) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        writeWaiters.current.delete(finished)
        signal.removeEventListener('abort', aborted)
      }
      const finished = () => { cleanup(); resolve() }
      const aborted = () => { cleanup(); reject(new Error('Loading interrupted')) }
      writeWaiters.current.add(finished)
      signal.addEventListener('abort', aborted, { once: true })
      if (signal.aborted) aborted()
    })
  }

  function loadSecondary(section: SecondarySection, version = readVersion.current, userId = owner.current) {
    if (!userId || !currentRead(version)) return Promise.resolve()
    const existing = secondaryJobs.current[section]
    if (existing) return existing
    const controller = new AbortController()
    controllers.current.add(controller)
    // A background refresh keeps successful content visible. Initial reads and
    // retries must not present an empty array as successfully loaded history.
    setSecondary(previous => ({ ...previous, [section]: previous[section] === 'ready' ? 'ready' : 'loading' }))
    const supabase = createClient()
    const read = async (query: any) => {
      const result = await query.abortSignal(controller.signal)
      if (result.error) throw result.error
      if (result.data == null) throw new Error('Missing response data')
      return result.data
    }
    const job = withLoadingDeadline(controller, async () => {
      // Waiting for an in-flight save is bounded by this section's deadline too.
      // Never read an older snapshot over a save, or unlock an uncertain write.
      await waitForWrites(controller.signal)
      if (!currentRead(version) || controller.signal.aborted) return
      if (section === 'health') {
        recoveryNeeded.current = false
        const [profileResult, journalResult] = await Promise.all([
          supabase.from('user_profiles').select('weight_unit').eq('id', userId).abortSignal(controller.signal).maybeSingle(),
          supabase.from('journal_entries').select('*').order('date', { ascending: false }).abortSignal(controller.signal),
        ])
        if (!currentRead(version) || controller.signal.aborted) return
        const journalError = !!journalResult.error || journalResult.data == null
        setCheckInLoadedDate(journalError ? null : today)
        if (profileResult.error || journalError) throw new Error('Health read failed')
        const profile = profileResult.data
        const js = journalResult.data || []
        // A background read cannot substitute another preference for a failed explicit choice.
        const failedChoice = failedWeightRecovery.current && (profile?.weight_unit === 'lbs' || profile?.weight_unit === 'kg')
        if (failedChoice || !profile || profile.weight_unit == null || (typeof profile.weight_unit === 'string' && profile.weight_unit.trim() === '')) {
          recoveryNeeded.current = true
          setNeedsWeightUnit(true)
          setSecondary(previous => ({ ...previous, health: 'needs-unit' }))
          return
        }
        if (profile.weight_unit !== 'lbs' && profile.weight_unit !== 'kg') throw new Error('Weight unit unavailable')
        setNeedsWeightUnit(false)
        setWeightRecoveryError(null)
        setEntries(js)
        // Background refreshes update recorded history, never the user's draft.
        const key = userId + ':' + today
        if (draftHydrated.current !== key) {
          draftHydrated.current = key
          // The unit belongs to the draft too. A remote preference refresh must
          // not relabel an edited pounds value as kilograms (or vice versa).
          setWeightUnit(profile.weight_unit)
          const todayEntry = js.find((e: any) => e.date === today)
          setMood(todayEntry?.mood ?? null); setEnergy(todayEntry?.energy ?? null); setHunger(todayEntry?.hunger ?? null)
          setEntryNotes(todayEntry?.notes || ''); setSaved(Boolean(todayEntry))
          const latestSleep = js.find((e: any) => e.sleep !== null && e.sleep !== undefined)?.sleep
          setSleep(latestSleep != null ? latestSleep.toString() : '')
          const latestWeight = js.find((e: any) => e.weight !== null && e.weight !== undefined)?.weight
          setWeight(latestWeight != null ? formatWeight(convertWeight(latestWeight, 'lbs', profile.weight_unit), profile.weight_unit) : '')
        }
      } else if (section === 'history') {
        const data = await read(supabase.from('injection_logs').select('compound_id, taken, date').eq('taken', true))
        if (!currentRead(version) || controller.signal.aborted) return
        setAllLogs(data)
      } else {
        const data = await read(supabase.from('protocols').select('id,name,status,start_date,compounds(id,name)').eq('status', 'planned'))
        if (!currentRead(version) || controller.signal.aborted) return
        setPlannedProtocols(data)
      }
      if (currentRead(version) && !controller.signal.aborted) {
        setSecondaryLoaded(previous => ({ ...previous, [section]: true }))
        setSecondary(previous => ({ ...previous, [section]: 'ready' }))
      }
    }).catch(() => {
      if (currentRead(version)) {
        if (mutations.current.size) setPendingSave(true)
        if (section === 'health') {
          setCheckInLoadedDate(null)
          if (!mutations.current.has('unit')) {
            recoveryNeeded.current = false
            setNeedsWeightUnit(false)
          }
        }
        setSecondary(previous => ({ ...previous, [section]: 'error' }))
      }
    }).finally(() => {
      controller.abort()
      controllers.current.delete(controller)
      if (secondaryJobs.current[section] === job) delete secondaryJobs.current[section]
    })
    secondaryJobs.current[section] = job
    return job
  }

  function loadAll(silent = false): Promise<void> {
    if (!mounted.current || mutations.current.size) return Promise.resolve()
    if (batch.current) return batch.current
    cancelReads()
    const version = readVersion.current
    if (!silent || !criticalReady.current) setLoading(true)
    setRefreshing(true)
    setLoadError(null)
    setSignedOut(false)
    const controller = new AbortController()
    controllers.current.add(controller)
    const supabase = createClient()
    const job = withLoadingDeadline(controller, async () => {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (!currentRead(version) || controller.signal.aborted) return
      if (error) {
        const ended = error.name === 'AuthSessionMissingError' || error.status === 401 ||
          ['refresh_token_not_found', 'session_not_found', 'user_not_found', 'bad_jwt'].includes(error.code || '')
        if (ended) throw new Error('signed-out')
        throw new Error('auth-unavailable')
      }
      if (!user) throw new Error('signed-out')
      if (owner.current && owner.current !== user.id) {
        resetScope()
        queueMicrotask(() => { if (mounted.current) void loadAll() })
        return
      }
      owner.current = user.id
      authIdentity.current = user.id
      setCheckInOwnerId(user.id)
      // Start all reads together, but only these three can gate daily actions.
      void loadSecondary('health', version, user.id)
      void loadSecondary('history', version, user.id)
      void loadSecondary('planned', version, user.id)
      const [ownershipResult, protocolsResult, logsResult] = await Promise.all([
        supabase.from('protocols').select('id').eq('user_id', user.id).limit(1).abortSignal(controller.signal),
        supabase.from('protocols').select('id, created_at, status, start_date, name, notes, compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, doses_taken_override, ml_per_dose, vials_in_stock, notes, phases(id, dosing_entry, dose_semantics_version, injection_volume_ml, syringe_units, syringe_scale, route, dose, dose_unit, frequency, day_of_week, days_of_week, start_week, end_week, name, time_of_day))').eq('status', 'active').abortSignal(controller.signal),
        supabase.from('injection_logs').select('*').eq('date', today).abortSignal(controller.signal),
      ])
      if (!currentRead(version) || controller.signal.aborted) return
      for (const result of [ownershipResult, protocolsResult, logsResult]) {
        if (result.error || result.data == null) throw new Error('Critical read failed')
      }
      if (onboardingEligible(user.id, ownershipResult.data) && !onboardingSeen(user.id)) {
        markOnboardingSeen(user.id)
        setRedirecting(true)
        setLoading(false)
        router.replace('/protocol/manage?new=1&onboarding=1')
        return
      }
      const configured = protocolsResult.data || []
      const protocols = orderRingProtocols(configured.filter((p: {start_date:string}) => p.start_date && p.start_date <= localCalendarDate()))
      setScheduledProtocols(configured.filter((p: {start_date:string}) => p.start_date > localCalendarDate()))
      setActiveProtocols(protocols)
    const due: DueCompound[] = []
    ;(protocols || []).forEach((p: any) => { (p.compounds||[]).forEach((c: any) => { const phase = selectCurrentPhase(c.phases as PhaseRow[] || [], p.start_date, new Date().toLocaleDateString('en-CA')); if (phase && (phase.dosing_entry || phase.dose_semantics_version === 1) && isDueToday(phase.frequency || '', p.start_date, phase.day_of_week ?? null, undefined, phase.days_of_week ?? undefined)) {
          const volumeMl = recordedDoseDisplay(phase).facts.volume?.value ?? null
          const syringeUnits = recordedDoseDisplay(phase).facts.markings?.value ?? null
          due.push({
            id: c.id,
            name: c.name,
            dose: recordedDoseDisplay(phase).primary,
            dose_unit: '',
            volume_ml: volumeMl,
            syringe_units: syringeUnits,
            time_of_day: phase.time_of_day || '',
            protocol_name: p.name
          })
        } }) })
    setDueCompounds(orderTodayDoses(due))

      const ls = logsResult.data || []
      const map: Record<string, LogEntry> = {}
      ls.forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } })
      setLogs(map)
      const hour = new Date().getHours()
      if (hour >= 20) {
        const logMap: Record<string, boolean> = {}
        ls.forEach((l: any) => { if (l.taken) logMap[l.compound_id] = true })
        setMissedDoses(due.filter((c: any) => !logMap[c.id]).map((c: any) => c.name))
      } else setMissedDoses([])
      criticalReady.current = true
      setCriticalDate(today)
      setLoading(false)
    }).catch(error => {
      if (!currentRead(version)) return
      if (error.message === 'signed-out') {
        resetScope()
        setSignedOut(true)
        setLoadError('Your session has ended. Sign in again to load your day.')
      } else {
        setLoadError(error.message === 'auth-unavailable'
          ? 'Your session could not be verified. Check your connection and try again.'
          : 'Your day could not be loaded. Your saved data has not changed.')
      }
      setLoading(false)
    }).finally(() => {
      controller.abort()
      controllers.current.delete(controller)
      if (currentRead(version)) setRefreshing(false)
      if (batch.current === job) batch.current = null
    })
    batch.current = job
    return job
  }

  // Invalidate reads before a write so an earlier response cannot undo a saved
  // dose or journal entry. Refresh once all concurrent, distinct saves finish.
  async function performMutation<T>(key: string, action: (isCurrent: () => boolean, ownerId: string) => Promise<T>): Promise<T | false> {
    if (!owner.current || mutations.current.has(key)) return false
    const version = scopeVersion.current
    const ownerId = owner.current
    const isCurrent = () => mounted.current && scopeVersion.current === version && owner.current === ownerId
    mutations.current.add(key)
    cancelReads()
    setRefreshing(false)
    // Suspended secondary sections keep a deadline and a functional retry even
    // if the save never responds. The mutation lock itself is not timed out.
    void loadSecondary('health')
    void loadSecondary('history')
    void loadSecondary('planned')
    try { return await action(isCurrent, ownerId) }
    finally {
      if (isCurrent()) {
        mutations.current.delete(key)
        if (!mutations.current.size) {
          setPendingSave(false)
          writeWaiters.current.forEach(finished => finished())
          void loadAll(true)
        }
      }
    }
  }

  function takeDose(cid: string, dateStr = today) {
    if (loadError || refreshing || !criticalReady.current || (dateStr !== today && secondary.history !== 'ready')) return
    return performMutation('dose', (isCurrent, ownerId) => toggleInjection(cid, dateStr, isCurrent, ownerId))
  }

  // Single write path for every dose log surface (today's focus card and the
  // weekly schedule table) so they always agree on what has been logged.
  async function toggleInjection(cid: string, dateStr: string = today, isCurrent = () => true, ownerId?: string) {
    if (doseSavePending.current) return
    doseSavePending.current = true
    const isToday = dateStr === today
    if (isToday) setTogglingId(cid)
    setDoseSaveError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!isCurrent()) return
      if (!user) throw new Error('Sign in again to save this dose.')
      if (ownerId && user.id !== ownerId) return
      const cur = isToday ? logs[cid] : undefined
      const wasTaken = isToday ? !!cur?.taken : allLogs.some(log => log.compound_id === cid && log.date === dateStr && log.taken)
      const taken = !wasTaken
      const { error } = await supabase.from('injection_logs').upsert({
        user_id: user.id, compound_id: cid, date: dateStr, taken, discomfort: cur?.discomfort || 0
      }, { onConflict: 'user_id,compound_id,date' })
      if (!isCurrent()) return
      if (error) throw error
      if (isToday) setLogs(previous => ({ ...previous, [cid]: { compound_id: cid, taken, discomfort: cur?.discomfort || 0 } }))
      setAllLogs(previous => [...previous.filter(log => !(log.compound_id === cid && log.date === dateStr)), ...(taken ? [{ compound_id: cid, date: dateStr, taken }] : [])])
      const { data: compound } = await supabase.from('compounds').select('doses_taken_override').eq('id', cid).single()
      if (!isCurrent()) return
      const currentDoses = compound?.doses_taken_override ?? 0
      await supabase.from('compounds').update({ doses_taken_override: taken ? currentDoses + 1 : Math.max(0, currentDoses - 1) }).eq('id', cid)
      if (isCurrent()) window.dispatchEvent(new Event('doses_updated'))
    } catch {
      if (isCurrent()) setDoseSaveError('This dose wasn’t saved. Please check your connection and try again.')
    } finally {
      if (isCurrent()) {
        doseSavePending.current = false
        if (isToday) setTogglingId(null)
      }
    }
  }
  async function setDiscomfortVal(cid: string, v: number) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: true, discomfort: v }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: true, discomfort: v } }) }
  // Mood/Energy/Hunger save instantly on tap via saveJournalField below. This
  // now only covers the secondary, typed fields that still need an explicit confirm.
  async function saveEntry(isCurrent = () => true, ownerId?: string) {
    try { navigator.vibrate(6) } catch(e) {}
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!isCurrent() || !user || (ownerId && user.id !== ownerId)) return false
      const row: any = { user_id: user.id, date: today, notes: entryNotes.trim() }
      if (sleep) row.sleep = parseFloat(sleep)
      if (weight) row.weight = convertWeight(parseFloat(weight), weightUnit, 'lbs')
      const { error } = await supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,date' })
      if (!isCurrent() || error) return false
      setSaved(true)
      loadAll(true)
      return true
    } catch {
      return false
    } finally {
      if (isCurrent()) setSaving(false)
    }
  }

  // Single-tap save for Mood/Energy/Hunger: a partial upsert touching only that
  // column, so it can never clobber Sleep/Weight/Notes. Optimistic update with a
  // per-field pending lock and revert-on-failure, same spirit as toggleInjection.
  async function saveJournalField(field: 'mood' | 'energy' | 'hunger', value: number, isCurrent = () => true, ownerId?: string) {
    if (scorePending.current[field]) return
    scorePending.current[field] = true
    setScoreError(previous => ({ ...previous, [field]: null }))
    const previousValue = field === 'mood' ? mood : field === 'energy' ? energy : hunger
    const setValue = field === 'mood' ? setMood : field === 'energy' ? setEnergy : setHunger
    setValue(value)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!isCurrent()) return
      if (!user) throw new Error('Sign in again to save this.')
      if (ownerId && user.id !== ownerId) return
      const { error } = await supabase.from('journal_entries').upsert({ user_id: user.id, date: today, [field]: value }, { onConflict: 'user_id,date' })
      if (!isCurrent()) return
      if (error) throw error
      setSaved(true)
      setCheckInRecordedDate(today)
    } catch {
      if (isCurrent()) {
        setValue(previousValue)
        setScoreError(previous => ({ ...previous, [field]: 'Not saved. Try again.' }))
      }
    } finally {
      if (isCurrent()) scorePending.current[field] = false
    }
  }

  // Recovery never assumes a display unit or changes a draft before persistence.
  function recoverWeightUnit(unit: WeightUnit) {
    if ((unit !== 'lbs' && unit !== 'kg') || !recoveryNeeded.current || mutations.current.size) return Promise.resolve(false)
    return performMutation('unit', async (isCurrent, ownerId) => {
      setWeightRecoveryPending(true)
      setWeightRecoveryError(null)
      try {
        const supabase = createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (!isCurrent()) return false
        if (authError || !user || user.id !== ownerId) throw new Error('Session could not be verified')
        const { data, error } = await supabase.from('user_profiles')
          .upsert({ id: ownerId, weight_unit: unit }, { onConflict: 'id' })
          .select('weight_unit')
          .single()
        if (!isCurrent()) return false
        if (error || data?.weight_unit !== unit) throw new Error('Weight unit was not persisted')
        if (draftHydrated.current === ownerId + ':' + today && weightUnit !== unit) {
          setWeight(draft => draft.trim() !== '' && Number.isFinite(Number(draft))
            ? formatWeight(convertWeight(Number(draft), weightUnit, unit), unit) : draft)
          setWeightUnit(unit)
        }
        recoveryNeeded.current = false
        failedWeightRecovery.current = false
        setNeedsWeightUnit(false)
        return true
      } catch {
        if (isCurrent()) {
          failedWeightRecovery.current = true
          setWeightRecoveryError('Weight unit could not be saved. Please try again.')
        }
        return false
      } finally {
        if (isCurrent()) setWeightRecoveryPending(false)
      }
    })
  }

  async function toggleWeightUnit(isCurrent = () => true, ownerId?: string) {
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
      if (!isCurrent()) return
      if (!user) throw new Error('Sign in again to save this.')
      if (ownerId && user.id !== ownerId) return
      const { data, error } = await supabase.from('user_profiles')
        .upsert({ id: user.id, weight_unit: newUnit }, { onConflict: 'id' })
        .select('weight_unit')
        .single()
      if (!isCurrent()) return
      if (error || data?.weight_unit !== newUnit) throw error ?? new Error('Weight unit was not persisted')
    } catch {
      if (isCurrent()) {
        setWeightUnit(previousUnit)
        // Preserve edits made while the preference save was pending, converting
        // their meaning back into the restored unit instead of replacing them.
        setWeight(draft => draft === (previousWeight.trim() !== '' && Number.isFinite(Number(previousWeight))
          ? formatWeight(convertWeight(Number(previousWeight), previousUnit, newUnit), newUnit) : previousWeight)
          ? previousWeight
          : draft.trim() !== '' && Number.isFinite(Number(draft))
            ? formatWeight(convertWeight(Number(draft), newUnit, previousUnit), previousUnit) : draft)
      }
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

  if (loading || (!loadError && !redirecting && criticalDate !== today)) return <main className={`today-main ${styles.page}`}><div className={styles.container}><TodayHeader date={today} /><div className="today-card today-loading" role="status">Loading your day…</div></div></main>

  const criticalError = loadError && <div className="today-card today-error" role="alert">{loadError}<br /><button className="today-text-link" onClick={() => void loadAll(criticalReady.current)}>Try again</button>{signedOut && <> · <a className="today-text-link" href="/auth/login?next=%2Fprotocol">Sign in again</a></>}</div>
  if (loadError && !criticalReady.current) return <main className={`today-main ${styles.page}`}><div className={styles.container}><TodayHeader date={today} />{criticalError}</div></main>
  if (redirecting) return <main className={`today-main ${styles.page}`}><div className={styles.container}><TodayHeader date={today} /><div className="today-card" role="status">Opening protocol setup… <a href="/protocol/manage?new=1&onboarding=1">Continue to setup</a></div></div></main>

  const historyStatus = <div className="today-card" role={secondary.history === 'error' ? 'alert' : 'status'}>{secondary.history === 'error' ? <>Schedule and protocol history couldn’t be loaded. <button className="today-text-link" onClick={() => void loadSecondary('history')}>Retry history</button></> : 'Loading schedule and protocol history…'}</div>
  const controlsDisabled = pendingSave || refreshing || !!loadError || togglingId !== null


  return (
    <main className={`today-main ${styles.page}`}>
      <div className={styles.container}>
        {criticalError}
        {pendingSave && <div className="today-card today-error" role="alert">A save is still pending. Your edits are kept here. Saving controls will recover when it finishes.</div>}
        <TodayOverview
          date={today} protocols={activeProtocols} entries={entries}
          healthStatus={secondary.health} healthAvailable={secondaryLoaded.health} onRetryHealth={() => void loadSecondary('health')}
          weightRecovery={needsWeightUnit ? { pending: weightRecoveryPending, disabled: controlsDisabled || secondary.health !== 'needs-unit', error: weightRecoveryError, onChoose: recoverWeightUnit } : undefined}
          due={dueCompounds} logs={logs} saving={controlsDisabled} onTaken={takeDose}
          error={doseSaveError} selected={activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id || null}
          weightUnit={weightUnit} onToggleUnit={() => { void performMutation('unit', toggleWeightUnit) }} onSelect={selectCompound}
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
          detail={activeProtocols.length > 0 && secondaryLoaded.history && <fieldset disabled={controlsDisabled || secondary.history !== 'ready'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><HeroProtocolCard
            snapshot
            activeProtocols={activeProtocols} activeCompoundTab={activeCompoundTab} logs={logs} allLogs={allLogs} totalLost={tl}
            compoundIndex={activeProtocols.flatMap((p: any) => p.compounds || []).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
          /></fieldset>}
          schedule={<>{secondary.history !== 'ready' && historyStatus}{secondaryLoaded.history && <fieldset disabled={controlsDisabled || secondary.history !== 'ready'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><WeeklySchedule activeProtocols={activeProtocols} allLogs={allLogs} onToggle={takeDose} disabled={controlsDisabled || secondary.history !== 'ready'} /></fieldset>}</>}
          checkin={secondaryLoaded.health && <fieldset disabled={secondary.health !== 'ready'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><DailyCheckInPrompt key={today} date={today} ownerId={checkInLoadedDate === today ? checkInOwnerId : null} recorded={checkInRecordedDate === today || entries.some(entry => entry.date === today)}>{dismiss => <DailyCheckIn
            today={today} entries={entries} mood={mood} energy={energy} hunger={hunger} sleep={sleep} weight={weight}
            notes={entryNotes} weightUnit={weightUnit} saving={saving} saved={saved} scoreError={scoreError}
            onScoreTap={(field, value) => { if (secondary.health === 'ready' && !recoveryNeeded.current) void performMutation(field, (isCurrent, ownerId) => saveJournalField(field, value, isCurrent, ownerId)) }} onSleepChange={setSleep} onWeightChange={setWeight} onNotesChange={setEntryNotes} onSave={() => secondary.health === 'ready' && !recoveryNeeded.current ? performMutation('journal', saveEntry) : Promise.resolve(false)} onSaved={dismiss}
          />}</DailyCheckInPrompt></fieldset>}
        />

        {secondaryLoaded.planned && <fieldset disabled={controlsDisabled || secondary.planned !== 'ready'} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><PlannedProtocols protocols={plannedProtocols} onActivated={() => void loadAll(true)} /></fieldset>}
        {secondary.planned !== 'ready' && <div className="today-card" role={secondary.planned === 'error' ? 'alert' : 'status'}>{secondary.planned === 'error' ? <>Planned protocols couldn’t be loaded. <button className="today-text-link" onClick={() => void loadSecondary('planned')}>Retry planned protocols</button></> : 'Loading planned protocols…'}</div>}
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
