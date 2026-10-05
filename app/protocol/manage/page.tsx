'use client'
import ProtocolDialog from '../../../components/protocols/ProtocolDialog'
import ProtocolLibrary from '../../../components/protocols/ProtocolLibrary'
import ProtocolDetail from '../../../components/protocols/ProtocolDetail'
import DoseSummary, { dosingIssue } from '../../../components/protocols/DoseSummary'
import { QuickChoices } from '../../../components/protocols/QuickStartControls'
import ProtocolQuickStart from '../../../components/protocols/ProtocolQuickStart'
import ProtocolSetupSuccess, { type SavedSetup } from '../../../components/protocols/ProtocolSetupSuccess'
import { markOnboardingSeen, onboardingEligible } from '../../../lib/protocols/onboarding'
import { newCompound, newPhaseCompoundDraft, phaseCompoundDraft, protocolCompoundPayload, updateCompoundDraft, type Compound } from '../../../lib/protocols/form'
import { createQuickStart, quickStartDates, quickStartIssue, requireIdentifier } from '../../../lib/protocols/quickStart'
import { loadInventoryItem } from '../../../lib/inventory/client'
import { localCalendarDate, protocolLifecycle, protocolSaveDates } from '../../../lib/health/protocolDates'
import { useLocalCalendarDate } from '../../../lib/health/useLocalCalendarDate'
import './protocols.css'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { currentPhase } from '../../../lib/health/dosing'
import { dosingDisplay, administrationDisplay, formatProtocolAmount, entryFromForm, entryFormState, interpretEntry, validDate } from '../../../lib/health/dosingEntry'
import { saveProtocolWithEvents, ProtocolSaveUncertainError, transitionProtocol, deleteOwnedProtocol } from '../../../lib/health/protocolMutations'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_NUMS = [1,2,3,4,5,6,0]
const TIMES = ['Morning','Afternoon','Evening','Night']
const UNITS = ['mg','mcg','IU']

export default function ManagePage() {
  const router = useRouter()
  const [detailId, setDetailId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [protocols, setProtocols] = useState<any[]>([])
  const [savedNotice,setSavedNotice] = useState('')
  const [firstProtocol, setFirstProtocol] = useState(false)
  const [setupSuccess, setSetupSuccess] = useState<SavedSetup | null>(null)
  const [retryBlocked, setRetryBlocked] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const savePending = useRef(false)
  const savedProtocolId = useRef<string | null>(null)
  const handoffInitialized = useRef(false)
  const ownerId = useRef<string | null>(null)
  const [fromInventory, setFromInventory] = useState(false)
  const mode = editingId === null ? 'create' : 'edit'
  const [planned, setPlanned] = useState(false)
  const [startDate, setStartDate] = useState(localCalendarDate())
  const [compounds, setCompounds] = useState<Compound[]>([newCompound()])
  const [saving, setSaving] = useState(false)
  const showCompleted = true
  const [confirmComplete, setConfirmComplete] = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [confirmReactivate, setConfirmReactivate] = useState<any>(null)
  const [reactivating, setReactivating] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [error, setError] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedProtocols, setSelectedProtocols] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [removedCompoundIds, setRemovedCompoundIds] = useState<string[]>([])
  const [continuedFromId, setContinuedFromId] = useState('')
  const today = useLocalCalendarDate()
  const editingProtocol = protocols.find(p => p.id === editingId)
  const preStart = editingProtocol?.status === 'active' && (editingProtocol.start_date || '') > today
  const [changeHappenedEarlier, setChangeHappenedEarlier] = useState(false)
  const [effectiveDate, setEffectiveDate] = useState('')
  const [completionHappenedEarlier, setCompletionHappenedEarlier] = useState(false)
  const [completionDate, setCompletionDate] = useState(today)
  const [quickValidationAttempts, setQuickValidationAttempts] = useState(0)
  const [openEditorPanel, setOpenEditorPanel] = useState<string | null>(null)
  const [openMoreOptions, setOpenMoreOptions] = useState<number | null>(null)

  useEffect(() => {
    const message = document.querySelector<HTMLElement>('[data-quick-error], .protocol-editor [role="alert"]')
    if (!message) return
    const panel = message.closest<HTMLElement>('.dosing-option-panel')
    const panelIndex = panel?.id.match(/^dosing-panel-(\d+)-/)
    if (panel && panelIndex) { setOpenMoreOptions(Number(panelIndex[1])); setOpenEditorPanel(panel.id.replace('dosing-panel-', '').replace(/-(?=[^-]+$)/, ':')) }
    let disclosure = message.closest('details')
    while (disclosure) { disclosure.open = true; disclosure = disclosure.parentElement?.closest('details') ?? null }
    requestAnimationFrame(() => { message.focus({ preventScroll: true }); message.scrollIntoView({ block: 'center' }) })
  }, [quickValidationAttempts, error])

  function protocolDurationLabel(p: any): string {
    if (!p?.start_date || !p?.completed_date) return ''
    const days = Math.max(0, Math.round((new Date(p.completed_date).getTime() - new Date(p.start_date + 'T00:00:00').getTime()) / 86400000))
    if (days < 7) return days + (days === 1 ? ' day protocol' : ' day protocol')
    const weeks = Math.round(days / 7)
    return weeks + ' week protocol'
  }

  const g = 'var(--color-green)', dg = 'var(--color-dim)', mg = 'var(--color-muted)'
  const cb = 'var(--color-card)', bd = 'var(--color-border)', inp = 'var(--color-input)'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      ownerId.current = user.id
      const { data, error: loadError } = await supabase.from('protocols').select('*, compounds(*, phases(*))').eq('user_id', user.id).order('created_at', { ascending: false })
      if (loadError) throw new Error('Protocols could not be loaded. Please refresh to try again.')
      setProtocols(data || [])
      const first = onboardingEligible(user.id, data)
      setFirstProtocol(first)
      const params = new URLSearchParams(window.location.search)
      if (first && params.get('new') === '1') markOnboardingSeen(user.id)
      if (!first && params.get('onboarding') === '1') { router.replace('/protocol'); return }
      if ((params.get('new') === '1' || params.has('dose')) && handoffInitialized.current) return
      const target = params.get('protocol')
      const compoundTarget = params.get('compound')
      const selected = params.get('new') === '1' ? undefined : data?.find(p => p.id === target || p.compounds?.some((c: { id: string }) => c.id === compoundTarget))
      if (selected && !showForm) { startEdit(selected); window.history.replaceState(null,'','/protocol/manage') }
      if (params.has('inventory') && params.get('new') === '1' && !showForm) {
        handoffInitialized.current = true
        try {
          const item = await loadInventoryItem(requireIdentifier(params.get('inventory') || ''), supabase)
          startNew(createQuickStart(params, item))
          setFromInventory(true)
          window.history.replaceState(null, '', '/protocol/manage')
        } catch (reason) {
          handoffInitialized.current = false
          setError(reason instanceof Error ? reason.message : 'Inventory could not be loaded.')
        }
      } else if (!selected && (params.get('new') === '1' || params.has('dose')) && !showForm) {
        handoffInitialized.current = true
        startNew(createQuickStart(params))
        window.history.replaceState(null,'','/protocol/manage')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Protocols could not be loaded. Please refresh to try again.')
    } finally { setLoading(false) }
  }

  async function completeProtocol() {
    if (!confirmComplete || savePending.current) return
    if (protocolLifecycle(confirmComplete, localCalendarDate()) === 'scheduled') return
    savePending.current = true
    try {
      setError('')
      await transitionProtocol({ protocolId: confirmComplete.id, action: 'complete', effectiveDate: completionHappenedEarlier ? completionDate || null : null })
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
      setConfirmComplete(null)
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to complete the protocol.') }
    finally { savePending.current = false }
  }

  async function changeStatus(protocol: any, action: 'pause' | 'resume') {
    try {
      await transitionProtocol({ protocolId: protocol.id, action, effectiveDate: today })
      setSavedNotice(action === 'pause' ? 'Protocol paused.' : 'Protocol resumed.')
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to update the protocol.') }
  }

  async function deleteCompletedProtocol() {
    if (!confirmDelete || savePending.current) return
    savePending.current = true
    setError('')
    try {
      await deleteOwnedProtocol(confirmDelete.id)
      setConfirmDelete(null); setDetailId(null)
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete protocol.') }
    finally { savePending.current = false }
  }

  async function reactivateProtocol() {
    if (!confirmReactivate || reactivating) return
    setError('')
    setReactivating(true)
    try {
      await transitionProtocol({ protocolId: confirmReactivate.id, action: 'reactivate', effectiveDate: today })
      setConfirmReactivate(null)
      setSavedNotice('Protocol reactivated.')
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reactivate the protocol.')
    } finally {
      setReactivating(false)
    }
  }

  async function bulkDeleteProtocols() {
    if (selectedProtocols.size === 0) return
    setError('')
    try {
      for (const id of selectedProtocols) await deleteOwnedProtocol(id)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to delete protocol.'); setConfirmBulkDelete(false); await load(); return }
    setSelectedProtocols(new Set())
    setSelectMode(false)
    setConfirmBulkDelete(false)
    load()
  }

  function toggleProtocolSelect(id: string) {
    const newSelected = new Set(selectedProtocols)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedProtocols(newSelected)
  }

  function selectAll() {
    const allIds = new Set(displayProtocols.map((p: any) => p.id))
    setSelectedProtocols(allIds)
  }

  function clearSelection() {
    setSelectedProtocols(new Set())
  }

  async function exportToCSV() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch all protocols with compounds, phases, and injection logs
    const { data: allProtocols } = await supabase
      .from('protocols')
      .select('id, name, start_date, status, compounds(id, name, vial_strength, vial_unit, bac_water_ml, ml_per_dose, phases(id, dosing_entry, dose, dose_unit, frequency, start_week, end_week, duration_weeks), injection_logs(date, taken))')
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
    link.download = `protocol-export-${new Date().toLocaleDateString('en-CA')}.csv`
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => window.URL.revokeObjectURL(url), 1_000)
  }

  function startNew(draft = createQuickStart()) {
    savedProtocolId.current = null
    setSetupSuccess(null)
    setRetryBlocked(false)
    setFromInventory(false)
    setSavedNotice('')
    window.scrollTo({ top: 0 })
    setDetailId(null)
    setRemovedCompoundIds([])
    setEditingId(null)
    setOpenEditorPanel(null)
    setOpenMoreOptions(null)
    setQuickValidationAttempts(0)
    setPlanned(!draft.startDate)
    setStartDate(draft.startDate)
    setCompounds(draft.compounds)
    setContinuedFromId('')
    setChangeHappenedEarlier(false)
    setEffectiveDate('')
    setShowForm(true)
    setError('')
  }

  function startEdit(p: any) {
    savedProtocolId.current = null
    setFromInventory(false)
    window.scrollTo({ top: 0 })
    setDetailId(null)
    setRemovedCompoundIds([])
    const parameters = new URLSearchParams(window.location.search)
    setEditingId(p.id)
    setChangeHappenedEarlier(false)
    setEffectiveDate('')
    setPlanned(p.status === 'planned')
    setStartDate(p.start_date || '')
    const cs = (p.compounds || []).map((c: any) => {
      const ph = currentPhase(c.phases || [], p.start_date || '', new Date().toLocaleDateString('en-CA')) || [...(c.phases || [])].sort((a, b) => b.start_week - a.start_week)[0]
      const freq = ph?.frequency || ''
      const isRolling = freq.startsWith('every') && freq.endsWith('days')
      const cycleDays = isRolling ? freq.replace('every','').replace('days','') : '3'
      const incomingMix = parameters.get('compound') === c.id && parameters.has('reconstitution_vial')
      const isPreMixed = !incomingMix && !c.vial_strength && !c.bac_water_ml && !c.reconstitution_date
      const preparationFacts = {
        isPreMixed, preparation: isPreMixed ? 'ready' as const : 'mixing' as const,
        vial_strength: c.vial_strength?.toString() || '', vial_unit: c.vial_unit || '', bac_water_ml: c.bac_water_ml?.toString() || '',
        concentration_value: c.concentration_value?.toString() || '', concentration_unit: c.concentration_unit || '',
      }
      const dosing = entryFormState(ph, preparationFacts)
      const handoffVialUnit = dosing.vial_unit || c.vial_unit || ''
      
      return {
        name: c.name, id: c.id, phase_id: ph?.id,
        phase_start_week: String(ph?.start_week || 1),
        route: ph?.route || '',
        phase_options: c.phases || [],
        reconstitution_date: incomingMix ? parameters.get('reconstitution_date') || '' : c.reconstitution_date || '',
        duration_weeks: ph?.end_week == null ? '' : String(ph.end_week - (ph.start_week || 1) + 1),
        frequency_mode: isRolling ? 'rolling' : 'weekly',
        days_of_week: ph?.days_of_week || [],
        cycle_days: cycleDays,
        time_of_day: ph?.time_of_day ? ph.time_of_day[0].toUpperCase() + ph.time_of_day.slice(1) : '',
        vials_in_stock: c.vials_in_stock?.toString() || '',
        notes: c.notes || '',
        ...dosing,
        ...(incomingMix ? {isPreMixed:false,preparation:'mixing' as const,vial_strength:parameters.get('reconstitution_vial') || '',vial_unit:handoffVialUnit,bac_water_ml:parameters.get('reconstitution_water') || '',concentration_value:'',concentration_unit:'',reviewed:false} : {}),
      }
    })
    if(parameters.get('action')==='add-phase') {
      const target=cs.find((c: Compound)=>c.id===parameters.get('compound'))
      if(target) Object.assign(target, newPhaseCompoundDraft(target))
    }
    setCompounds(cs.length ? cs : [newCompound()])
    setOpenEditorPanel(parameters.get('action') === 'add-phase' ? `${Math.max(0, cs.findIndex((c: Compound) => c.id === parameters.get('compound')))}:phases` : null)
    setOpenMoreOptions(parameters.get('action') === 'add-phase' ? Math.max(0, cs.findIndex((c: Compound) => c.id === parameters.get('compound'))) : null)
    setContinuedFromId(p.continued_from_protocol_id || '')
    setShowForm(true)
    setError('')
  }

  function updateCompound(i: number, field: string, value: any) {
    setCompounds(current => current.map((c, index) => index === i ? updateCompoundDraft(c, field as keyof Compound, value) : c))
  }

  function toggleDay(ci: number, dayNum: number) {
    const u = [...compounds]
    const days = u[ci].days_of_week
    u[ci].days_of_week = days.includes(dayNum) ? days.filter(d => d !== dayNum) : [...days, dayNum]
    setCompounds(u)
  }

  async function save() {
    if (savePending.current || savedProtocolId.current || retryBlocked) return
    setError('')
    if (mode === 'create') {
      setQuickValidationAttempts(attempt => attempt + 1)
      if (quickStartIssue({ startDate, compounds })) return
    }
    if (!compounds.length || compounds.some(c => !c.name.trim())) { setError('Every compound needs a name.'); return }
    if (compounds.some(c => c.reconstitution_date && !validDate(c.reconstitution_date))) {setError('Enter a valid calendar date.');return}
    savePending.current = true
    setSaving(true)
    try {
      const dates = mode === 'create' ? quickStartDates(startDate) : protocolSaveDates({ mode, planned, startDate, today: localCalendarDate(), originalStartDate: editingProtocol?.status === 'active' ? editingProtocol.start_date : null, useDifferentDate: changeHappenedEarlier, effectiveDate })
      const payload = protocolCompoundPayload(compounds)
      savedProtocolId.current = await saveProtocolWithEvents({ protocolId: editingId, name: compounds[0].name.trim(), ...dates,
        compounds: payload, continuedFromId: continuedFromId || null, removedCompoundIds,
      })
      if (mode === 'create') {
        setSetupSuccess({ id: savedProtocolId.current, draft: { startDate, compounds }, payload, firstProtocol })
        return
      }
      setSavedNotice('Saved'); setShowForm(false); setEditingId(null); await load()
    } catch (error) {
      if (mode === 'create' && error instanceof ProtocolSaveUncertainError) {
        setRetryBlocked(true)
        setError('We could not confirm whether this protocol saved. Your entries are kept here. Check your saved protocols before starting another setup.')
      } else setError(mode === 'create' ? 'Your protocol could not be saved. Your entries are kept. Please try again.' : error instanceof Error ? error.message : 'Unable to save dosing.')
    }
    finally { savePending.current = false; setSaving(false) }
  }

  const activeProtocols = protocols.filter(p => p.status !== 'completed' && p.status !== 'planned')
  const plannedProtocols = protocols.filter(p => p.status === 'planned')
  const completedProtocols = protocols.filter(p => p.status === 'completed')
  const displayProtocols = showCompleted ? [...activeProtocols, ...plannedProtocols, ...completedProtocols] : [...activeProtocols, ...plannedProtocols]

  const is = { width:'100%', background:inp, border:'1px solid '+bd, borderRadius:'8px', padding:'10px 12px', color:'var(--color-text)', fontSize:'15px', boxSizing:'border-box' as const }

  function cancelForm() {
    if (firstProtocol) { if (ownerId.current) markOnboardingSeen(ownerId.current); router.push('/protocol') }
    else if (fromInventory) router.push('/protocol/inventory')
    else { setShowForm(false); setEditingId(null) }
  }

  const continuationField = <>{completedProtocols.filter(cp => cp.id !== editingId).length > 0 && (
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>CONTINUING A PREVIOUS PROTOCOL? <span style={{color:mg,fontWeight:'400',textTransform:'none',letterSpacing:0}}>(optional)</span></label>
                <select aria-label='Continuing a previous protocol' value={continuedFromId} onChange={e => setContinuedFromId(e.target.value)} style={is}>
                  <option value=''>None</option>
                  {completedProtocols.filter(cp => cp.id !== editingId).map(cp => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name} — {protocolDurationLabel(cp).replace(' protocol','s')}, ended {new Date(cp.completed_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                    </option>
                  ))}
                </select>
                <p style={{fontSize:'11px',color:mg,marginTop:'4px'}}>Links this protocol to a completed one — for resuming after a break, or evolving into a new blend. Your history carries over as a badge on the dashboard.</p>
              </div>
            )}</>

  if (loading) return <main className="protocols-page"><div className="protocols-container"><header className="protocols-header"><h1>Protocols</h1></header><p role="status">Loading your protocols…</p></div></main>
  if (setupSuccess) return <ProtocolSetupSuccess saved={setupSuccess} today={today} />

  return (
    <main className={`protocols-page${showForm && mode === 'create' ? ' protocols-focused' : showForm ? ' dosing-editor-v2' : ''}`}>
      <div className={`protocols-container${showForm && mode === 'create' ? ' protocols-creation-container' : ''}`}>
        {!detailId && !(showForm && mode === 'create') && <header className="protocols-header">
          <div><h1>{showForm ? (editingId ? `Edit ${compounds.length === 1 ? compounds[0].name || 'protocol' : 'protocol'}` : 'Add Protocol') : 'Protocols'}</h1><p>{showForm ? (editingId ? 'Update what you know. You can add details later.' : 'Choose a compound and confirm the basics.') : 'Your plans, at a glance.'}</p></div>
          {!showForm && <button className="protocol-primary" onClick={() => startNew()}>+ Add Protocol</button>}
        </header>}
        {!showForm && !detailId && <details className="protocol-library-tools"><summary>Library tools</summary><div className="protocol-action-row">
          <button onClick={exportToCSV}>Export CSV</button>
          <button onClick={() => {setSelectMode(!selectMode);clearSelection()}}>{selectMode ? 'Cancel selection' : 'Select protocols to delete'}</button>
        </div></details>}

        {selectMode && selectedProtocols.size > 0 && (
          <div style={{background:'rgba(255,107,107,0.1)',border:'1px solid rgba(255,107,107,0.3)',borderRadius:'12px',padding:'14px 16px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div style={{fontSize:'13px',color:dg,fontWeight:'600'}}>
              {selectedProtocols.size} protocol{selectedProtocols.size !== 1 ? 's' : ''} selected
            </div>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={selectAll} style={{background:'none',border:'1px solid #ff6b6b',color:'#ff6b6b',borderRadius:'6px',padding:'6px 12px',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Select All</button>
              <button onClick={() => setConfirmBulkDelete(true)} style={{background:'#ff6b6b',border:'none',color:'#fff',borderRadius:'6px',padding:'6px 16px',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Delete Selected</button>
            </div>
          </div>
        )}

        {savedNotice && <p role="status" className="protocol-saved-notice">{savedNotice}</p>}
        {error && !showForm && !confirmComplete && !confirmReactivate && <p role="alert" className="protocol-error">{error}</p>}
      {showForm && (
          <div className="protocol-editor">
            {fromInventory && <p>Creating a protocol will not change your inventory quantity.</p>}
            {editingId && planned && <p>Planned protocols stay off your schedule until you activate them. No start date is needed yet.</p>}
            {mode === 'create' ? <ProtocolQuickStart value={{ startDate, compounds }} firstProtocol={firstProtocol} onSave={save} onClose={cancelForm} saving={saving} retryBlocked={retryBlocked} saveError={error} today={today} onChange={draft => { setStartDate(draft.startDate); setPlanned(!draft.startDate); setCompounds(draft.compounds) }}>{continuationField}</ProtocolQuickStart> : <>
            {compounds.map((c, ci) => {
              const reviewEntry = (() => { try { return entryFromForm(c) } catch { return null } })()
              const reviewResult = (() => { try { return reviewEntry ? interpretEntry(reviewEntry) : null } catch { return null } })()
              const reviewIssue = (() => { try { return reviewEntry ? dosingIssue(reviewEntry) : null } catch { return null } })()
              const showConfirmation = Boolean((reviewResult?.medication || reviewResult?.candidate) && (c.input_mode === 'unknown' || c.input_mode === 'medication' || c.reviewed))
              const panelId = (name: string) => `${ci}:${name}`
              const selectedPanel = (name: string) => openEditorPanel === panelId(name)
              const administrationSummary = [c.route, c.syringe_markings && `${c.syringe_markings} units`, c.injection_volume && `${c.injection_volume} mL`].filter(Boolean).join(' · ') || 'Route and measurements'
              const vialSummary = [c.vial_strength && `${c.vial_strength} ${c.vial_unit}`.trim(), c.bac_water_ml && `${c.bac_water_ml} mL`, c.concentration_value && `${c.concentration_value} ${c.concentration_unit}`.trim()].filter(Boolean).join(' · ') || 'Vial preparation'
              const scheduleSummary = [c.frequency_mode === 'rolling' ? `Every ${c.cycle_days || '?'} days` : c.days_of_week.length === 7 ? 'Daily' : c.days_of_week.length === 1 ? 'Weekly' : c.days_of_week.length ? `${c.days_of_week.length}x/week` : 'Schedule', c.frequency_mode === 'weekly' && c.days_of_week.length < 3 ? c.days_of_week.map(day => ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day]).join(' · ') : '', c.time_of_day].filter(Boolean).join(' · ')
              const phaseSummary = c.phase_options?.find(phase => phase.id === c.phase_id)
              return (
              <div key={ci} className="dosing-compound">
                {compounds.length > 1 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
                    <span style={{fontSize:'11px',color:mg,fontWeight:'700',letterSpacing:'1px'}}>COMPOUND {ci+1}</span>
                    <button onClick={() => { if (c.id && !confirm('Remove this compound and its linked history when you save?')) return; if(c.id) setRemovedCompoundIds(ids => [...ids,c.id!]); setCompounds(compounds.filter((_,i) => i!==ci)) }} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'12px'}}>Remove</button>
                  </div>
                )}

                {compounds.length > 1 && <header className="dosing-compound-heading"><h2>{c.name || 'Your compound'}</h2></header>}

                <section className="dosing-primary" aria-label={`Dosing for ${c.name || 'your compound'}`}>
                <QuickChoices label="How do you measure it?" className="dosing-methods" value={c.input_mode} options={[["medication", 'Medication dose'], ['syringe', 'Syringe units'], ['volume', 'Volume'], ['unknown', 'I’m not sure']]} onChange={value => updateCompound(ci,'input_mode',value)} />
                <div className="dosing-mode-fields">
                  {c.input_mode === 'unknown' && <p className="dosing-reassurance">That’s okay. Add what you know. You can save now and add details later.</p>}
                  {(c.input_mode === 'syringe' || c.input_mode === 'unknown') && <>
                    <label>{c.input_mode === 'syringe' ? 'How much do you draw?' : 'Syringe units (optional)'}<input aria-label="Syringe markings" inputMode="decimal" type="number" min="0" step="any" value={c.syringe_markings} onChange={e => updateCompound(ci,'syringe_markings',e.target.value)} style={is} /></label>
                    <label>Syringe scale<select aria-label="Syringe scale" style={is} value={c.syringe_scale} onChange={e => updateCompound(ci,'syringe_scale',e.target.value)}><option value="">Not selected</option>{c.syringe_scale && !['100','40'].includes(c.syringe_scale) && <option value={c.syringe_scale} disabled>Stored U-{c.syringe_scale} (unsupported; preserved)</option>}<option value="100">U-100</option><option value="40">U-40</option></select></label>
                  </>}
                  {(c.input_mode === 'volume' || c.input_mode === 'unknown') && <label>{c.input_mode === 'volume' ? 'Injection volume' : 'Injection volume (optional)'}<div className="dosing-amount-row"><input aria-label="Injection volume (mL)" inputMode="decimal" type="number" step="any" min="0" style={is} value={c.injection_volume} onChange={e => updateCompound(ci,'injection_volume',e.target.value)} /><span>mL</span></div></label>}
                  {c.input_mode === 'medication' ? <>
                  <label htmlFor={`edit-dose-${ci}`}>Medication amount</label>
                  <div className="dosing-amount-row">
                    <input id={`edit-dose-${ci}`} aria-label='Medication dose' inputMode="decimal" type='number' step='any' value={c.dose} onChange={e => updateCompound(ci,'dose',e.target.value)} placeholder='e.g. 5' style={{...is,flex:1}} />
                    <select aria-label='Medication dose unit' value={c.dose_unit} onChange={e => updateCompound(ci,'dose_unit',e.target.value)} style={{...is,width:'75px',flex:'none'}}>
                      <option value=''>Select unit</option>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  </> : null}
                </div>

                <div className="dosing-live-summary" aria-live="polite" aria-atomic="true">
                  {!(openMoreOptions === ci && selectedPanel('vial') && reviewIssue) && (() => { try { return <DoseSummary phase={{ dosing_entry: entryFromForm(c) }} editing onReview={target => {
                    setOpenMoreOptions(ci)
                    const panel = target === 'syringe' ? 'administration' : 'vial'
                    setOpenEditorPanel(panelId(panel))
                    requestAnimationFrame(() => {
                      const openedPanel = document.getElementById(`dosing-panel-${ci}-${panel}`)
                      openedPanel?.scrollIntoView({ block: 'nearest' })
                      if (panel === 'vial') openedPanel?.querySelector<HTMLElement>('.dosing-review-panel > summary')?.focus()
                    })
                  }} /> } catch (reason) { return <p role="alert">{reason instanceof Error ? reason.message : 'Check the entered amounts.'}</p> } })()}
                </div>
                </section>
                <details className="dosing-more-options" id={`dosing-options-${ci}`} open={openMoreOptions === ci} onToggle={event => { if (event.currentTarget.open) setOpenMoreOptions(ci); else if (openMoreOptions === ci) { setOpenMoreOptions(null); setOpenEditorPanel(null) } }}><summary>More options</summary>
                <div className="dosing-secondary" id={`dosing-details-${ci}`}>
                <div className="dosing-option-grid" role="group" aria-label="More protocol options">
                  {([
                    ['administration', 'Administration', administrationSummary],
                    ['vial', 'Vial', vialSummary],
                    ['schedule', 'Schedule', scheduleSummary],
                    ['inventory', 'Inventory', c.vials_in_stock ? `${c.vials_in_stock} vials` : 'Stock and notes'],
                    ['phases', 'Phases', phaseSummary ? `Weeks ${phaseSummary.start_week}–${phaseSummary.end_week ?? 'ongoing'}` : `Week ${c.phase_start_week || '1'}`],
                    ['other', 'Other', 'Name · dates · help'],
                  ] as const).map(([name, title, summary]) => <button type="button" className="dosing-option-card" key={name} aria-expanded={selectedPanel(name)} aria-controls={`dosing-panel-${ci}-${name}`} onClick={() => setOpenEditorPanel(selectedPanel(name) ? null : panelId(name))}><strong>{title}</strong><small>{summary}</small></button>)}
                </div>
                <section className="dosing-option-panel" id={`dosing-panel-${ci}-administration`} aria-label="Administration" hidden={!selectedPanel('administration')}>
                <div className="protocol-fields">
                  <label>Route<select aria-label="Route" style={is} value={c.route} onChange={e => updateCompound(ci,'route',e.target.value)}><option value="">Not recorded</option><option>IM</option><option>SubQ</option>{(!editingId || c.route === 'Oral') && <option>Oral</option>}{(!editingId || c.route === 'Other') && <option>Other</option>}</select></label>
                  {(c.input_mode === 'medication' || c.input_mode === 'volume') && <>
                    <label>Syringe units<input aria-label="Syringe markings" inputMode="decimal" type="number" min="0" step="any" value={c.syringe_markings} onChange={e => updateCompound(ci,'syringe_markings',e.target.value)} style={is} /></label>
                    <label>Syringe scale<select aria-label="Syringe scale" style={is} value={c.syringe_scale} onChange={e => updateCompound(ci,'syringe_scale',e.target.value)}><option value="">Not selected</option>{c.syringe_scale && !['100','40'].includes(c.syringe_scale) && <option value={c.syringe_scale} disabled>Saved U-{c.syringe_scale}</option>}<option value="100">U-100</option><option value="40">U-40</option></select></label>
                  </>}
                  {(c.input_mode === 'medication' || c.input_mode === 'syringe') && <label>Entered injection volume<div className="dosing-amount-row"><input aria-label="Injection volume (mL)" inputMode="decimal" type="number" step="any" min="0" style={is} value={c.injection_volume} onChange={e => updateCompound(ci,'injection_volume',e.target.value)} /><span>mL</span></div></label>}
                </div>
                </section>
                <section className="dosing-option-panel" id={`dosing-panel-${ci}-vial`} aria-label="Vial" hidden={!selectedPanel('vial')}><div className="protocol-fields">
                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}}>
                    <input
                      type='checkbox'
                      checked={c.isPreMixed}
                      onChange={e => updateCompound(ci, 'isPreMixed', e.target.checked)}
                      style={{width:'18px',height:'18px',cursor:'pointer'}}
                    />
                    <span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'600'}}>
                      Ready to use
                    </span>
                  </label>
                </div>

                {!c.isPreMixed && (
                  <>
                    <div className="protocol-intake-fields">
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>Vial amount</label>
                        <div style={{display:'flex',gap:'6px'}}>
                          <input aria-label='Vial amount' type='number' value={c.vial_strength} onChange={e => updateCompound(ci,'vial_strength',e.target.value)} placeholder='10' style={{...is,flex:1}} />
                          <select aria-label='Vial unit' value={c.vial_unit} onChange={e => updateCompound(ci,'vial_unit',e.target.value)} style={{...is,width:'65px',flex:'none'}}>
                            <option value=''>Select unit</option>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>Liquid added</label>
                        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                          <input aria-label='BAC water in mL' type='number' step='0.5' value={c.bac_water_ml} onChange={e => updateCompound(ci,'bac_water_ml',e.target.value)} placeholder='3' style={{...is,flex:1}} />
                          <span style={{fontSize:'13px',color:dg,fontWeight:'600',whiteSpace:'nowrap'}}>mL</span>
                        </div>
                      </div>
                    </div>

                  </>
                )}

                {c.isPreMixed && <div style={{marginBottom:12}}>
                  <label>Labelled concentration (optional)</label>
                  <div style={{display:'flex',gap:8}}>
                    <input aria-label="Concentration value" type="number" step="any" value={c.concentration_value} onChange={e => updateCompound(ci,'concentration_value',e.target.value)} style={is} />
                    <select aria-label="Concentration unit" value={c.concentration_unit} onChange={e => updateCompound(ci,'concentration_unit',e.target.value)} style={is}>
                      <option value="">Select unit</option>{['mg/mL','mcg/mL','IU/mL'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>}
                </div>
                {reviewIssue && <div className="dosing-panel-issue" role="status"><strong>{reviewIssue.title}</strong></div>}
                <details className="dosing-review-panel" data-dose-review hidden={!reviewIssue && !showConfirmation}><summary>Review calculation</summary>
                  {(() => { try {
                    if (!reviewEntry || !reviewResult) return null
                    const result = reviewResult
                    const administration = administrationDisplay({ dosing_entry: reviewEntry })
                    const recordedAmount = c.input_mode === 'unknown' ? formatProtocolAmount(reviewEntry.dose, reviewEntry.dose_unit) : null
                    const medicationAmount = result.medication && formatProtocolAmount(result.medication.value, result.medication.unit)
                    const candidateAmount = !medicationAmount && result.candidate && formatProtocolAmount(result.candidate.value, result.candidate.unit)
                    return <div className="dosing-calculation-details">
                      <dl>
                        {recordedAmount && <><dt>Recorded value</dt><dd>{recordedAmount}</dd></>}
                        {medicationAmount && <><dt>Medication amount</dt><dd>{medicationAmount}</dd></>}
                        {candidateAmount && <><dt>Calculated medication amount</dt><dd>{candidateAmount}</dd></>}
                        {administration.volume && <><dt>Injection volume</dt><dd>{administration.volume}</dd></>}
                        {administration.syringe && <><dt>Syringe draw</dt><dd>{administration.syringe}</dd></>}
                        {result.concentration && <><dt>Concentration</dt><dd>{formatProtocolAmount(result.concentration.value, `${result.concentration.unit}/mL`)}</dd></>}
                      </dl>
                      {reviewIssue && <p className="dosing-review-explanation">{reviewIssue.explanation}</p>}
                    </div>
                  } catch (reason) { return <p role="alert">{reason instanceof Error ? reason.message : 'Check numeric inputs.'}</p> } })()}
                  <label className="dosing-confirmation" hidden={!showConfirmation}><input type="checkbox" checked={c.reviewed} onChange={e => updateCompound(ci,'reviewed',e.target.checked)} /> I confirm this medication amount (optional).</label>
                </details>
                </section>
                <section className="dosing-option-panel" id={`dosing-panel-${ci}-inventory`} aria-label="Inventory" hidden={!selectedPanel('inventory')}><div className="protocol-fields">
                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>Vials in stock</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <input aria-label='Vials in stock' type='number' min='0' value={c.vials_in_stock} onChange={e => updateCompound(ci,'vials_in_stock',e.target.value)} placeholder='0' style={{...is,width:'80px',flex:'none'}} />
                    <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>vials</span>
                  </div>
                </div>

                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>Notes (optional)</label>
                  <textarea aria-label='Notes' value={c.notes} onChange={e => updateCompound(ci,'notes',e.target.value)} placeholder='Goals, context, side effects...' rows={2} style={{...is,resize:'none'}} />
                </div>

                </div></section>
                <section className="dosing-option-panel" id={`dosing-panel-${ci}-schedule`} aria-label="Schedule" hidden={!selectedPanel('schedule')}><div className="protocol-fields">
                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'10px'}}>Schedule pattern</label>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button
                      onClick={() => updateCompound(ci, 'frequency_mode', 'weekly')}
                      style={{
                        flex:1,
                        padding:'10px',
                        borderRadius:'8px',
                        border:'1px solid '+(c.frequency_mode==='weekly'?g:bd),
                        background:c.frequency_mode==='weekly'?'var(--color-green-10)':'transparent',
                        color:c.frequency_mode==='weekly'?g:dg,
                        fontSize:'13px',
                        fontWeight:'700',
                        cursor:'pointer'
                      }}
                    >
                      Weekly pattern
                    </button>
                    <button
                      onClick={() => updateCompound(ci, 'frequency_mode', 'rolling')}
                      style={{
                        flex:1,
                        padding:'10px',
                        borderRadius:'8px',
                        border:'1px solid '+(c.frequency_mode==='rolling'?g:bd),
                        background:c.frequency_mode==='rolling'?'var(--color-green-10)':'transparent',
                        color:c.frequency_mode==='rolling'?g:dg,
                        fontSize:'13px',
                        fontWeight:'700',
                        cursor:'pointer'
                      }}
                    >
                      Every few days
                    </button>
                  </div>
                </div>

                {c.frequency_mode === 'weekly' && (
                  <div style={{marginBottom:'16px'}}>
                    <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'10px'}}>Days and time</label>
                    <div style={{background:'var(--color-surface)',borderRadius:'10px',padding:'14px'}}>
                      <div className="protocol-day-picker" style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'12px'}}>
                        {DAYS.map((day, di) => {
                          const dayNum = DAY_NUMS[di]
                          const active = c.days_of_week.includes(dayNum)
                          return (
                            <button aria-pressed={active} key={day} onClick={() => toggleDay(ci, dayNum)} style={{padding:'10px 0',borderRadius:'8px',border:'1px solid '+(active?g:bd),background:active?'var(--color-green-10)':'transparent',color:active?g:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                              <span>{day}</span>
                              {active && <span style={{width:'5px',height:'5px',borderRadius:'50%',background:g,display:'block'}} />}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px'}}>
                        {TIMES.map(t => (
                          <button aria-pressed={c.time_of_day===t} key={t} onClick={() => updateCompound(ci,'time_of_day',t)} style={{padding:'8px 4px',borderRadius:'8px',border:'1px solid '+(c.time_of_day===t?g:bd),background:c.time_of_day===t?'var(--color-green-10)':'transparent',color:c.time_of_day===t?g:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {c.frequency_mode === 'rolling' && (
                  <div style={{marginBottom:'16px'}}>
                    <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>Repeat every</label>
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                      <input
                        aria-label='Days between doses'
                        type='number'
                        min='1'
                        max='7'
                        value={c.cycle_days}
                        onChange={e => updateCompound(ci, 'cycle_days', e.target.value)}
                        style={{...is,width:'80px',flex:'none'}}
                      />
                      <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>days</span>
                    </div>
                  </div>
                )}

                {!editingId && (
                  <div style={{marginTop:'16px'}}>
                    <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>PLANNED DURATION (optional)</label>
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                      <input aria-label='Planned duration weeks' type='number' min='1' max='52' placeholder='Ongoing' value={c.duration_weeks} onChange={e => updateCompound(ci,'duration_weeks',e.target.value)} style={{...is,width:'80px',flex:'none'}} />
                      <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>weeks</span>
                    </div>
                    <p style={{fontSize:'11px',color:mg,marginTop:'6px'}}>Leave blank if ongoing.</p>
                  </div>
                )}

                </div></section>

                {editingId && <section className="dosing-option-panel" id={`dosing-panel-${ci}-phases`} aria-label="Phases" hidden={!selectedPanel('phases')}><div className="protocol-fields">
                {c.id && <div style={{marginBottom:12}}>
                  <select aria-label="Select phase" value={c.phase_id || ''} style={is} onChange={e => {
                    const rawCompound = protocols.flatMap(p => p.compounds || []).find(x => x.id === c.id)
                    const raw = rawCompound?.phases?.find((p: { id: string }) => p.id === e.target.value)
                    if (!rawCompound || !raw) return
                    const phaseIsPreMixed = !rawCompound.vial_strength && !rawCompound.bac_water_ml && !rawCompound.reconstitution_date
                    const preparation = { isPreMixed: phaseIsPreMixed, preparation: phaseIsPreMixed ? 'ready' as const : 'mixing' as const,
                      vial_strength: rawCompound.vial_strength?.toString() || '', vial_unit: rawCompound.vial_unit || '', bac_water_ml: rawCompound.bac_water_ml?.toString() || '',
                      concentration_value: rawCompound.concentration_value?.toString() || '', concentration_unit: rawCompound.concentration_unit || '' }
                    const updated = [...compounds]; updated[ci] = phaseCompoundDraft(c, raw, preparation); setCompounds(updated)
                  }}><option value="">New phase</option>{c.phase_options?.map(p => <option key={p.id} value={p.id}>{p.name}: weeks {p.start_week}–{p.end_week || 'ongoing'}</option>)}</select>
                  <button type="button" onClick={() => { const updated=[...compounds]; updated[ci]=newPhaseCompoundDraft(c);setCompounds(updated) }}>Add phase</button>
                </div>}
                <label>Phase start week<input aria-label="Phase start week" type="number" min="1" style={is} value={c.phase_start_week} onChange={e => updateCompound(ci,'phase_start_week',e.target.value)} /></label>
                {editingId && protocols.find(p=>p.id===editingId)?.status==='active' && c.phase_id && c.phase_options?.every(p=>p.id===c.phase_id || p.start_week<Number(c.phase_start_week)) && c.duration_weeks && <button type="button" className="dosing-set-ongoing" onClick={()=>updateCompound(ci,'duration_weeks','')}>Set ongoing</button>}
                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>Phase length (optional)</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <input aria-label='Phase duration weeks' type='number' min='1' max='52' placeholder='Ongoing' value={c.duration_weeks} onChange={e => updateCompound(ci,'duration_weeks',e.target.value)} style={{...is,width:'80px',flex:'none'}} />
                    <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>weeks</span>
                  </div>
                </div>

                </div></section>}

                <section className="dosing-option-panel" id={`dosing-panel-${ci}-other`} aria-label="Other options" hidden={!selectedPanel('other')}>
                <div className="protocol-fields">
                  <label>Compound name<input aria-label='Compound name' value={c.name} onChange={e => updateCompound(ci,'name',e.target.value)} placeholder='e.g. Retatrutide, Test C' style={is} /></label>
                  <label>Vial label (optional)<input aria-label="Vial label" style={is} value={c.vial_label} onChange={e => updateCompound(ci,'vial_label',e.target.value)} /></label>
                  {!c.isPreMixed && <label>Date mixed (optional)<input aria-label='Reconstitution date' type='date' value={c.reconstitution_date} onChange={e => updateCompound(ci,'reconstitution_date',e.target.value)} style={is} /></label>}
                  <p className="dosing-unit-help"><strong>Help with units</strong><br />mg, mcg and IU describe medication; mL describes liquid; syringe units are syringe markings.</p>
                </div>
                {ci === 0 && <>
                <section className="dosing-disclosure dosing-protocol-dates"><h3>Protocol dates &amp; links</h3>
                {editingId && !planned && <div style={{marginBottom:'16px'}}>
                  <label htmlFor="protocol-start-date" style={{display:'block',fontSize:'13px',color:dg,marginBottom:'6px'}}>Protocol start date</label>
                  <input id="protocol-start-date" aria-label="Protocol start date" type='date' required value={startDate} onChange={e => setStartDate(e.target.value)} style={is} />
                  {startDate > today && <p>Scheduled · Starts {startDate}. Tracking begins automatically.</p>}
                </div>}
                {continuationField}
                </section>
                {editingId && !planned && !preStart && <div className="protocol-effective-date">
                  <button type="button" aria-expanded={changeHappenedEarlier} onClick={() => {setChangeHappenedEarlier(!changeHappenedEarlier);setEffectiveDate('')}}>Use a different effective date</button>
                  {changeHappenedEarlier && <label>Effective date<input aria-label="Effective date" type="date" min={startDate} max={today} value={effectiveDate} onChange={event => setEffectiveDate(event.target.value)} style={is} /></label>}
                  <p>Changes are effective today unless you choose another date.</p>
                </div>}
                </>}
                {ci === compounds.length - 1 && <button type="button" className="dosing-add-compound" onClick={() => setCompounds([...compounds, newCompound()])}>+ Add another compound</button>}
                </section>
                </div>
                </details>
                {ci < compounds.length - 1 && <div style={{height:'1px',background:bd,margin:'20px 0'}} />}
              </div>
            )})}

            </>}

            {error && mode === 'edit' && <div role="alert" tabIndex={-1} style={{background:'rgba(255,107,107,0.1)',border:'1px solid rgba(255,107,107,0.3)',borderRadius:'8px',padding:'12px',fontSize:'13px',color:'#ff6b6b',marginBottom:'16px'}}>{error}</div>}

            {mode === 'edit' && <div className="protocol-save-bar">
              <button disabled={saving} onClick={cancelForm} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={save} disabled={saving} style={{flex:2,background:saving?'var(--color-green-20)':g,color:saving?mg:'var(--color-green-text)',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>{saving?'Saving...':mode === 'edit'?'Save changes':startDate?'Start tracking':'Save protocol'}</button>
            </div>}
          </div>
        )}

        {!showForm && !detailId && <ProtocolLibrary onReload={load} protocols={protocols} today={new Date().toLocaleDateString('en-CA')} onOpen={id => {setDetailId(id);window.scrollTo({top:0})}} onAdd={() => startNew()} selecting={selectMode} selected={selectedProtocols} onSelect={toggleProtocolSelect} />}
        {!showForm && detailId && (() => {
          const selected = protocols.find(p => p.id === detailId)
          if (!selected) return <button className="protocol-back" onClick={() => setDetailId(null)}>Return to protocols</button>
          return <ProtocolDetail key={selected.id} protocol={selected} today={today} onBack={() => setDetailId(null)}
            onEdit={(compoundId, addPhase) => {
              if (addPhase && compoundId) window.history.replaceState(null, '', '/protocol/manage?compound=' + encodeURIComponent(compoundId) + '&action=add-phase')
              startEdit(selected)
              if (addPhase) window.history.replaceState(null, '', '/protocol/manage')
            }}
            onComplete={() => { setError(''); setCompletionHappenedEarlier(false); setCompletionDate(today); setConfirmComplete(selected) }} onReactivate={() => { setError(''); setConfirmReactivate(selected) }}
            onPause={() => void changeStatus(selected, 'pause')} onResume={() => void changeStatus(selected, 'resume')}
            onDelete={() => {setError('');setConfirmDelete(selected)}}
            onReload={load} />
        })()}

        {confirmComplete && protocolLifecycle(confirmComplete, today) !== 'scheduled' && (
          <ProtocolDialog title="Complete protocol" onClose={() => setConfirmComplete(null)}>
            <div style={{
              background:cb,
              border:'1px solid '+bd,
              borderRadius:'16px',
              padding:'24px',
              maxWidth:'400px',
              width:'100%'
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px',color:g}}>Mark as Complete?</h3>
              <p style={{fontSize:'14px',color:dg,marginBottom:'20px',lineHeight:'1.5'}}>
                This will archive <strong>{confirmComplete.name}</strong> from your active stack. All data will be preserved.
              </p>
              <label className="protocol-check"><input type="checkbox" checked={completionHappenedEarlier} onChange={event => {setCompletionHappenedEarlier(event.target.checked);setCompletionDate('')}} /> This protocol ended earlier</label>
              {completionHappenedEarlier && <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'16px'}}>Completion date<input aria-label="Completion date" type="date" min={confirmComplete.start_date} max={today} value={completionDate} onChange={event => setCompletionDate(event.target.value)} style={{...is,marginTop:'6px'}} /></label>}
              {error && <p role="alert" className="protocol-error">{error}</p>}
              <div style={{display:'flex',gap:'10px'}}>
                <button 
                  onClick={() => setConfirmComplete(null)}
                  style={{
                    flex:1,
                    background:cb,
                    color:dg,
                    border:'1px solid '+bd,
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    cursor:'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={completeProtocol}
                  style={{
                    flex:1,
                    background:'#22c55e',
                    color:'#000',
                    border:'none',
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    fontWeight:'700',
                    cursor:'pointer'
                  }}
                >
                  Complete
                </button>
              </div>
            </div>
          </ProtocolDialog>
        )}

        {confirmDelete && (
          <ProtocolDialog title="Delete protocol" onClose={() => setConfirmDelete(null)}>
            <div style={{
              background:cb,
              border:'1px solid '+bd,
              borderRadius:'16px',
              padding:'24px',
              maxWidth:'400px',
              width:'100%'
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px',color:'#ff6b6b'}}>Delete Protocol?</h3>
              <p style={{fontSize:'14px',color:dg,marginBottom:'20px',lineHeight:'1.5'}}>
                Permanently delete <strong>{confirmDelete.name}</strong> and all its data. This cannot be undone.
              </p>
              {error && <p role="alert" className="protocol-error">{error}</p>}
              <div style={{display:'flex',gap:'10px'}}>
                <button 
                  onClick={() => setConfirmDelete(null)}
                  style={{
                    flex:1,
                    background:cb,
                    color:dg,
                    border:'1px solid '+bd,
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    cursor:'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={deleteCompletedProtocol}
                  style={{
                    flex:1,
                    background:'#ff6b6b',
                    color:'#fff',
                    border:'none',
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    fontWeight:'700',
                    cursor:'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </ProtocolDialog>
        )}

        {confirmReactivate && (
          <ProtocolDialog title="Reactivate protocol" onClose={() => setConfirmReactivate(null)}>
            <div style={{
              background:cb,
              border:'1px solid '+bd,
              borderRadius:'16px',
              padding:'24px',
              maxWidth:'400px',
              width:'100%'
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px',color:g}}>Reactivate Protocol?</h3>
              <p style={{fontSize:'14px',color:dg,marginBottom:'20px',lineHeight:'1.5'}}>
                Restore <strong>{confirmReactivate.name}</strong> to your active protocols. You can resume tracking where you left off.
              </p>
              {error && <p role="alert" className="protocol-error" style={{margin:'0 0 16px',fontSize:'13px'}}>{error}</p>}
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                <button 
                  type="button"
                  onClick={() => setConfirmReactivate(null)}
                  disabled={reactivating}
                  style={{
                    flex:'1 1 140px',
                    background:cb,
                    color:dg,
                    border:'1px solid '+bd,
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    cursor:'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={reactivateProtocol}
                  disabled={reactivating}
                  style={{
                    flex:'1 1 140px',
                    background:g,
                    color:'var(--color-green-text)',
                    border:'none',
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    fontWeight:'700',
                    cursor:'pointer'
                  }}
                >
                  {reactivating ? 'Reactivating…' : 'Reactivate'}
                </button>
              </div>
            </div>
          </ProtocolDialog>
        )}

        {confirmBulkDelete && (
          <ProtocolDialog title="Delete selected protocols" onClose={() => setConfirmBulkDelete(false)}>
            <div style={{
              background:cb,
              border:'1px solid '+bd,
              borderRadius:'16px',
              padding:'24px',
              maxWidth:'400px',
              width:'100%'
            }} onClick={e => e.stopPropagation()}>
              <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px',color:'#ff6b6b'}}>Delete {selectedProtocols.size} Protocol{selectedProtocols.size !== 1 ? 's' : ''}?</h3>
              <p style={{fontSize:'14px',color:dg,marginBottom:'20px',lineHeight:'1.5'}}>
                Permanently delete {selectedProtocols.size} protocol{selectedProtocols.size !== 1 ? 's' : ''} and all their data. This cannot be undone.
              </p>
              <div style={{display:'flex',gap:'10px'}}>
                <button 
                  onClick={() => setConfirmBulkDelete(false)}
                  style={{
                    flex:1,
                    background:cb,
                    color:dg,
                    border:'1px solid '+bd,
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    cursor:'pointer'
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={bulkDeleteProtocols}
                  style={{
                    flex:1,
                    background:'#ff6b6b',
                    color:'#fff',
                    border:'none',
                    borderRadius:'8px',
                    padding:'12px',
                    fontSize:'14px',
                    fontWeight:'700',
                    cursor:'pointer'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          </ProtocolDialog>
        )}

        {showConfetti && (
          <div style={{
            position:'fixed',
            top:'50%',
            left:'50%',
            transform:'translate(-50%, -50%)',
            zIndex:10000,
            pointerEvents:'none'
          }}>
            <div style={{
              background:'#22c55e',
              color:'#000',
              padding:'20px 32px',
              borderRadius:'16px',
              fontSize:'24px',
              fontWeight:'800',
              boxShadow:'0 10px 40px rgba(34,197,94,0.3)',
              animation:'celebrate 0.5s ease-out'
            }}>
              Protocol Complete!
            </div>
            <style>{`
              @keyframes celebrate {
                0% { transform: scale(0.8); opacity: 0; }
                50% { transform: scale(1.1); }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        )}
      </div>
    </main>
  )
}
