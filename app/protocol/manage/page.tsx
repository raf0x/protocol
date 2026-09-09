'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'
import { calculateDosing, dosingFields, currentPhase } from '../../../lib/health/dosing'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_NUMS = [1,2,3,4,5,6,0]
const TIMES = ['Morning','Afternoon','Evening','Night']
const UNITS = ['mg','mcg','IU']

type Compound = {
  id?: string
  phase_id?: string
  phase_start_week: string
  concentration_value: string
  concentration_unit: string
  syringe_scale: string
  route: string
  reviewed: boolean
  phase_options?: { id: string; name: string; start_week: number; end_week: number | null }[]
  name: string
  isPreMixed: boolean
  vial_strength: string
  vial_unit: string
  bac_water_ml: string
  reconstitution_date: string
  dose: string
  dose_unit: string
  duration_weeks: string
  frequency_mode: 'weekly' | 'rolling'
  days_of_week: number[]
  cycle_days: string
  time_of_day: string
  vials_in_stock: string
  notes: string
}

function newCompound(): Compound {
  return {
    name: '', phase_start_week: '1', concentration_value: '', concentration_unit: '', syringe_scale: '', route: '', reviewed: true,
    isPreMixed: false,
    vial_strength: '',
    vial_unit: 'mg',
    bac_water_ml: '',
    reconstitution_date: new Date().toISOString().split('T')[0],
    dose: '',
    dose_unit: 'mg',
    duration_weeks: '12',
    frequency_mode: 'weekly',
    days_of_week: [],
    cycle_days: '3',
    time_of_day: 'Morning',
    vials_in_stock: '',
    notes: '',
  }
}

export default function ManagePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [protocols, setProtocols] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [compounds, setCompounds] = useState<Compound[]>([newCompound()])
  const [saving, setSaving] = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)
  const [confirmComplete, setConfirmComplete] = useState<any>(null)
  const [confirmDelete, setConfirmDelete] = useState<any>(null)
  const [confirmReactivate, setConfirmReactivate] = useState<any>(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [error, setError] = useState('')
  const [selectMode, setSelectMode] = useState(false)
  const [selectedProtocols, setSelectedProtocols] = useState<Set<string>>(new Set())
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [removedCompoundIds, setRemovedCompoundIds] = useState<string[]>([])
  const [continuedFromId, setContinuedFromId] = useState('')

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
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data } = await supabase.from('protocols').select('*, compounds(*, phases(*))').order('created_at', { ascending: false })
    setProtocols(data || [])
    const target = new URLSearchParams(window.location.search).get('protocol')
    const compoundTarget = new URLSearchParams(window.location.search).get('compound')
    const selected = data?.find(p => p.id === target || p.compounds?.some((c: { id: string }) => c.id === compoundTarget))
    if (selected && !showForm) { startEdit(selected); window.history.replaceState(null,'','/protocol/manage') }
    const params = new URLSearchParams(window.location.search)
    if (!selected && params.has('dose') && !showForm) { setCompounds([{...newCompound(),name:params.get('name') || '',dose:params.get('dose') || '',dose_unit:params.get('dose_unit') || '',vial_strength:params.get('vial') || '',vial_unit:params.get('vial_unit') || '',bac_water_ml:params.get('water') || '',syringe_scale:params.get('syringe_scale') || ''}]);setShowForm(true);window.history.replaceState(null,'','/protocol/manage') }
    setLoading(false)
  }

  async function completeProtocol() {
    if (!confirmComplete) return
    const supabase = createClient()
    await supabase.from('protocols').update({ 
      status: 'completed', 
      completed_date: new Date().toISOString() 
    }).eq('id', confirmComplete.id)
    
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 3000)
    setConfirmComplete(null)
    load()
  }

  async function deleteCompletedProtocol() {
    if (!confirmDelete) return
    const supabase = createClient()
    await supabase.from('protocols').delete().eq('id', confirmDelete.id)
    setConfirmDelete(null)
    load()
  }

  async function reactivateProtocol() {
    if (!confirmReactivate) return
    const supabase = createClient()
    await supabase.from('protocols').update({ 
      status: 'active',
      completed_date: null
    }).eq('id', confirmReactivate.id)
    setConfirmReactivate(null)
    load()
  }

  async function bulkDeleteProtocols() {
    if (selectedProtocols.size === 0) return
    const supabase = createClient()
    for (const id of selectedProtocols) {
      await supabase.from('protocols').delete().eq('id', id)
    }
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
      .select('id, name, start_date, status, compounds(id, name, vial_strength, vial_unit, bac_water_ml, ml_per_dose, phases(id, dose, dose_unit, frequency, start_week, end_week, duration_weeks), injection_logs(date, taken))')
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
              phase.dose,
              phase.dose_unit || '-',
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

  function startNew() {
    setRemovedCompoundIds([])
    setEditingId(null)
    setStartDate(new Date().toISOString().split('T')[0])
    setCompounds([newCompound()])
    setContinuedFromId('')
    setShowForm(true)
    setError('')
  }

  function startEdit(p: any) {
    setRemovedCompoundIds([])
    const parameters = new URLSearchParams(window.location.search)
    setEditingId(p.id)
    setStartDate(p.start_date)
    const cs = (p.compounds || []).map((c: any) => {
      const ph = currentPhase(c.phases || [], p.start_date, new Date().toLocaleDateString('en-CA')) || [...(c.phases || [])].sort((a, b) => b.start_week - a.start_week)[0]
      const freq = ph?.frequency || ''
      const isRolling = freq.startsWith('every') && freq.endsWith('days')
      const cycleDays = isRolling ? freq.replace('every','').replace('days','') : '3'
      const incomingMix = parameters.get('compound') === c.id && parameters.has('reconstitution_vial')
      const isPreMixed = !incomingMix && !c.vial_strength && !c.bac_water_ml && !c.reconstitution_date
      
      return {
        name: c.name, id: c.id, phase_id: ph?.id,
        phase_start_week: String(ph?.start_week || 1),
        concentration_value: c.concentration_value?.toString() || '', concentration_unit: c.concentration_unit || '',
        syringe_scale: ph?.syringe_scale?.toString() || '', route: ph?.route || '', reviewed: ph?.dose_semantics_version === 1,
        phase_options: c.phases || [],
        isPreMixed,
        vial_strength: incomingMix ? parameters.get('reconstitution_vial') || '' : c.vial_strength?.toString() || '',
        vial_unit: c.vial_unit || '',
        bac_water_ml: incomingMix ? parameters.get('reconstitution_water') || '' : c.bac_water_ml?.toString() || '',
        reconstitution_date: incomingMix ? parameters.get('reconstitution_date') || '' : c.reconstitution_date || new Date().toISOString().split('T')[0],
        dose: ph?.dose?.toString() || '',
        dose_unit: ph?.dose_unit || '',
        duration_weeks: ph?.end_week == null ? '' : String(ph.end_week - (ph.start_week || 1) + 1),
        frequency_mode: isRolling ? 'rolling' : 'weekly',
        days_of_week: ph?.days_of_week || [],
        cycle_days: cycleDays,
        time_of_day: ph?.time_of_day || 'Morning',
        vials_in_stock: c.vials_in_stock?.toString() || '',
        notes: c.notes || '',
      }
    })
    setCompounds(cs.length ? cs : [newCompound()])
    setContinuedFromId(p.continued_from_protocol_id || '')
    setShowForm(true)
    setError('')
  }

  function updateCompound(i: number, field: string, value: any) {
    const u = [...compounds]
    ;(u[i] as any)[field] = value
    if (['dose','dose_unit'].includes(field)) u[i].reviewed = false
    setCompounds(u)
  }

  function toggleDay(ci: number, dayNum: number) {
    const u = [...compounds]
    const days = u[ci].days_of_week
    u[ci].days_of_week = days.includes(dayNum) ? days.filter(d => d !== dayNum) : [...days, dayNum]
    setCompounds(u)
  }

  async function save() {
    setError('')
    if (compounds.some(c => !c.name.trim())) { setError('Every compound needs a name.'); return }
    if (compounds.some(c => !c.dose.trim())) { setError('Every compound needs a dose.'); return }
    if (compounds.some(c => !c.isPreMixed && !c.reconstitution_date)) { 
      setError('Reconstitution date is required for compounds that need mixing.'); 
      return 
    }
    if (compounds.some(c => !c.isPreMixed && !c.bac_water_ml)) { 
      setError('BAC water amount is required for compounds that need mixing.'); 
      return 
    }
    
    for (const c of compounds) {
      if (c.frequency_mode === 'weekly' && c.days_of_week.length === 0) {
        setError('Select at least one injection day for weekly schedules.')
        return
      }
      if (c.frequency_mode === 'rolling') {
        const cycle = parseInt(c.cycle_days)
        if (isNaN(cycle) || cycle < 1 || cycle > 7) {
          setError('Cycle days must be between 1 and 7.')
          return
        }
      }
    }
    
    if (compounds.some(c => !c.reviewed)) { setError('Confirm that each dose is medication amount, not syringe markings.'); return }
    setSaving(true)
    try {
      const payload = compounds.map(c => {
        const fields = dosingFields({ dose: Number(c.dose), dose_unit: c.dose_unit,
          concentration_value: c.isPreMixed && c.concentration_value ? Number(c.concentration_value) : null,
          concentration_unit: c.isPreMixed ? c.concentration_unit || null : null,
          vial_strength: !c.isPreMixed && c.vial_strength ? Number(c.vial_strength) : null,
          vial_unit: c.vial_unit, bac_water_ml: !c.isPreMixed && c.bac_water_ml ? Number(c.bac_water_ml) : null,
          syringe_scale: c.syringe_scale ? Number(c.syringe_scale) : null,
        })
        const start = Number(c.phase_start_week)
        const duration = c.duration_weeks ? Number(c.duration_weeks) : null
        if (!Number.isInteger(start) || start < 1 || (duration != null && (!Number.isInteger(duration) || duration < 1))) throw new Error('Enter valid phase weeks.')
        return { id: c.id || null, name: c.name.trim(), ...fields.compound,
          vial_strength: c.isPreMixed ? null : Number(c.vial_strength), vial_unit: c.isPreMixed ? null : c.vial_unit,
          bac_water_ml: c.isPreMixed ? null : Number(c.bac_water_ml), reconstitution_date: c.isPreMixed ? null : c.reconstitution_date,
          notes: c.notes.trim(), vials_in_stock: c.vials_in_stock ? Number(c.vials_in_stock) : null,
          phase: { id: c.phase_id || null, ...fields.phase, start_week: start, end_week: duration == null ? null : start + duration - 1,
            frequency: c.frequency_mode === 'rolling' ? `every${c.cycle_days}days` : c.days_of_week.length === 7 ? 'daily' : `${c.days_of_week.length}x/week`,
            days_of_week: c.frequency_mode === 'weekly' ? c.days_of_week : [], day_of_week: c.frequency_mode === 'weekly' ? c.days_of_week[0] : null,
            time_of_day: c.time_of_day.toLowerCase(), route: c.route || null },
        }
      })
      const { error: saveError } = await createClient().rpc('save_protocol_dosing_v1', {
        p_protocol_id: editingId, p_name: compounds[0].name.trim(), p_start_date: startDate, p_compounds: payload, p_continued_from_id: continuedFromId || null, p_removed_compound_ids: removedCompoundIds,
      })
      if (saveError) throw saveError
      setShowForm(false); setEditingId(null); await load()
    } catch (error) { setError(error instanceof Error ? error.message : (error as { message?: string }).message || 'Unable to save dosing.') }
    finally { setSaving(false) }
  }

  async function deleteProtocol(id: string) {
    if (!confirm('Delete this protocol and all its data?')) return
    const supabase = createClient()
    await supabase.from('protocols').delete().eq('id', id)
    load()
  }

  const activeProtocols = protocols.filter(p => p.status !== 'completed')
  const completedProtocols = protocols.filter(p => p.status === 'completed')
  const displayProtocols = showCompleted ? [...activeProtocols, ...completedProtocols] : activeProtocols

  const is = { width:'100%', background:inp, border:'1px solid '+bd, borderRadius:'8px', padding:'10px 12px', color:'var(--color-text)', fontSize:'15px', boxSizing:'border-box' as const, colorScheme:'dark' as const }

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',color:'var(--color-text)',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <button onClick={() => router.push('/protocol')} style={{background:'none',border:'none',color:'#fff',fontSize:'16px',cursor:'pointer',padding:0,marginBottom:'14px',fontWeight:'600'}}>↑ Return to Dashboard</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:g}}>My Protocols</h1>
          {!showForm && (
            <div style={{display:'flex',gap:'8px'}}>
              <button 
                onClick={exportToCSV}
                style={{background:'var(--color-card)',color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}
              >
                ↓ Export CSV
              </button>
              <button 
                onClick={() => {
                  setSelectMode(!selectMode)
                  clearSelection()
                }}
                style={{background:selectMode?'#ff6b6b':'var(--color-card)',color:selectMode?'#fff':dg,border:'1px solid '+(selectMode?'#ff6b6b':bd),borderRadius:'8px',padding:'10px 16px',fontSize:'13px',fontWeight:'600',cursor:'pointer'}}
              >
                {selectMode ? '✕ Cancel' : 'Delete Multiple'}
              </button>
              <button onClick={startNew} style={{background:g,color:'var(--color-green-text)',border:'none',borderRadius:'8px',padding:'10px 20px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>+ New</button>
            </div>
          )}
        </div>

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

        {showForm && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'16px',padding:'20px',marginBottom:'24px'}}>
            <h2 style={{fontSize:'18px',fontWeight:'800',marginBottom:'20px',color:g}}>{editingId ? 'Edit Protocol' : 'New Protocol'}</h2>

            {compounds.map((c, ci) => (
              <div key={ci} style={{marginBottom:'24px'}}>
                {compounds.length > 1 && (
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
                    <span style={{fontSize:'11px',color:mg,fontWeight:'700',letterSpacing:'1px'}}>COMPOUND {ci+1}</span>
                    <button onClick={() => { if (c.id && !confirm('Remove this compound and its linked history when you save?')) return; if(c.id) setRemovedCompoundIds(ids => [...ids,c.id!]); setCompounds(compounds.filter((_,i) => i!==ci)) }} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'12px'}}>Remove</button>
                  </div>
                )}

                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>COMPOUND NAME</label>
                  <input value={c.name} onChange={e => updateCompound(ci,'name',e.target.value)} placeholder='e.g. Retatrutide, Test C' style={is} />
                </div>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer'}}>
                    <input 
                      type='checkbox' 
                      checked={c.isPreMixed} 
                      onChange={e => updateCompound(ci, 'isPreMixed', e.target.checked)}
                      style={{width:'18px',height:'18px',cursor:'pointer'}}
                    />
                    <span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'600'}}>
                      Pre-mixed compound (no reconstitution needed)
                    </span>
                  </label>
                  <p style={{fontSize:'11px',color:mg,marginTop:'4px',marginLeft:'28px'}}>
                    Check this for TRT, pre-mixed peptides, or any compound that doesn't require mixing
                  </p>
                </div>

                {!c.isPreMixed && (
                  <>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>VIAL STRENGTH</label>
                        <div style={{display:'flex',gap:'6px'}}>
                          <input type='number' value={c.vial_strength} onChange={e => updateCompound(ci,'vial_strength',e.target.value)} placeholder='10' style={{...is,flex:1}} />
                          <select value={c.vial_unit} onChange={e => updateCompound(ci,'vial_unit',e.target.value)} style={{...is,width:'65px',flex:'none'}}>
                            <option value=''>Select unit</option>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>BAC WATER</label>
                        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                          <input type='number' step='0.5' value={c.bac_water_ml} onChange={e => updateCompound(ci,'bac_water_ml',e.target.value)} placeholder='3' style={{...is,flex:1}} />
                          <span style={{fontSize:'13px',color:dg,fontWeight:'600',whiteSpace:'nowrap'}}>mL</span>
                        </div>
                      </div>
                    </div>

                    <div style={{marginBottom:'12px'}}>
                      <label style={{display:'block',fontSize:'11px',color:'#ff6b6b',fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>RECONSTITUTION DATE *</label>
                      <input type='date' value={c.reconstitution_date} onChange={e => updateCompound(ci,'reconstitution_date',e.target.value)} style={is} />
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
                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>MEDICATION DOSE PER ADMINISTRATION</label>
                  <div style={{display:'flex',gap:'6px'}}>
                    <input aria-label='Medication dose' type='number' step='any' value={c.dose} onChange={e => updateCompound(ci,'dose',e.target.value)} placeholder='e.g. 60' style={{...is,flex:1}} />
                    <select aria-label='Medication dose unit' value={c.dose_unit} onChange={e => updateCompound(ci,'dose_unit',e.target.value)} style={{...is,width:'75px',flex:'none'}}>
                      <option value=''>Select unit</option>{UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <p style={{fontSize:12,color:dg}}>IU means medication International Units, never syringe markings.</p>
                <label style={{display:'block',marginBottom:12,fontSize:13}}>
                  <input type="checkbox" checked={c.reviewed} onChange={e => updateCompound(ci,'reviewed',e.target.checked)} /> I confirm the medication dose and unit above.
                </label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:12}}>
                  <label>Syringe scale<select aria-label="Syringe scale" style={is} value={c.syringe_scale} onChange={e => updateCompound(ci,'syringe_scale',e.target.value)}><option value="">Not selected</option><option value="100">U-100</option><option value="40">U-40</option></select></label>
                  <label>Route<select aria-label="Route" style={is} value={c.route} onChange={e => updateCompound(ci,'route',e.target.value)}><option value="">Not recorded</option><option>IM</option><option>SubQ</option></select></label>
                </div>
                {(() => { try {
                  const result = calculateDosing({ dose:Number(c.dose), dose_unit:c.dose_unit,
                    concentration_value:c.isPreMixed && c.concentration_value ? Number(c.concentration_value):null,
                    concentration_unit:c.isPreMixed ? c.concentration_unit || null:null,
                    vial_strength:!c.isPreMixed && c.vial_strength ? Number(c.vial_strength):null, vial_unit:c.vial_unit,
                    bac_water_ml:!c.isPreMixed && c.bac_water_ml ? Number(c.bac_water_ml):null, syringe_scale:c.syringe_scale ? Number(c.syringe_scale):null })
                  return <p style={{fontSize:13,color:g}}>{result.injectionVolume ? `Injection volume: ${Number(result.injectionVolume.value.toPrecision(6))} mL` : 'Volume not calculated without concentration.'}{result.syringeUnits && ` · ${Number(result.syringeUnits.value.toPrecision(6))} syringe units (U-${result.syringeUnits.scale})`}</p>
                } catch { return null } })()}
                {c.id && <div style={{marginBottom:12}}>
                  <p style={{fontSize:12,color:dg}}>Editing only the selected phase. Other phases and recorded injections are preserved.</p>
                  <select aria-label="Select phase" value={c.phase_id || ''} style={is} onChange={e => {
                    const raw = protocols.flatMap(p => p.compounds || []).find(x => x.id === c.id)?.phases?.find((p: { id: string }) => p.id === e.target.value)
                    if (!raw) return
                    const updated = [...compounds]; updated[ci] = {...c, phase_id:raw.id, dose:String(raw.dose),dose_unit:raw.dose_unit,phase_start_week:String(raw.start_week),duration_weeks:raw.end_week == null ? '' : String(raw.end_week-raw.start_week+1), reviewed:raw.dose_semantics_version===1,
                      syringe_scale:raw.syringe_scale?.toString() || '',route:raw.route || '',days_of_week:raw.days_of_week || [], frequency_mode:raw.frequency?.startsWith('every') ? 'rolling':'weekly',cycle_days:raw.frequency?.replace('every','').replace('days','') || '3'};setCompounds(updated)
                  }}><option value="">New phase</option>{c.phase_options?.map(p => <option key={p.id} value={p.id}>{p.name}: weeks {p.start_week}–{p.end_week || 'ongoing'}</option>)}</select>
                  <button type="button" onClick={() => { const updated=[...compounds]; updated[ci]={...c,phase_id:undefined,phase_start_week:String(Math.max(1,...(c.phase_options || []).map(p => (p.end_week || p.start_week)+1))),duration_weeks:'12',reviewed:false};setCompounds(updated) }}>Add phase</button>
                </div>}
                <label>Phase start week<input aria-label="Phase start week" type="number" min="1" style={is} value={c.phase_start_week} onChange={e => updateCompound(ci,'phase_start_week',e.target.value)} /></label>
                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>PHASE DURATION (blank means ongoing)</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <input aria-label='Phase duration weeks' type='number' min='1' max='52' value={c.duration_weeks} onChange={e => updateCompound(ci,'duration_weeks',e.target.value)} style={{...is,width:'80px',flex:'none'}} />
                    <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>weeks</span>
                  </div>
                </div>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'10px'}}>FREQUENCY MODE</label>
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
                      Weekly Pattern
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
                      Rolling Cycle
                    </button>
                  </div>
                </div>

                {c.frequency_mode === 'weekly' && (
                  <div style={{marginBottom:'16px'}}>
                    <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'10px'}}>MY SCHEDULE</label>
                    <div style={{background:'var(--color-surface)',borderRadius:'10px',padding:'14px'}}>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:'4px',marginBottom:'12px'}}>
                        {DAYS.map((day, di) => {
                          const dayNum = DAY_NUMS[di]
                          const active = c.days_of_week.includes(dayNum)
                          return (
                            <button key={day} onClick={() => toggleDay(ci, dayNum)} style={{padding:'10px 0',borderRadius:'8px',border:'1px solid '+(active?g:bd),background:active?'var(--color-green-10)':'transparent',color:active?g:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
                              <span>{day}</span>
                              {active && <span style={{width:'5px',height:'5px',borderRadius:'50%',background:g,display:'block'}} />}
                            </button>
                          )
                        })}
                      </div>
                      {c.days_of_week.length > 0 && (
                        <p style={{fontSize:'12px',color:dg,margin:'0 0 10px',textAlign:'center'}}>{c.days_of_week.length}x per week</p>
                      )}
                      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px'}}>
                        {TIMES.map(t => (
                          <button key={t} onClick={() => updateCompound(ci,'time_of_day',t)} style={{padding:'8px 4px',borderRadius:'8px',border:'1px solid '+(c.time_of_day===t?g:bd),background:c.time_of_day===t?'var(--color-green-10)':'transparent',color:c.time_of_day===t?g:dg,fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {c.frequency_mode === 'rolling' && (
                  <div style={{marginBottom:'16px'}}>
                    <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>INJECT EVERY</label>
                    <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                      <input
                        type='number'
                        min='1'
                        max='7'
                        value={c.cycle_days}
                        onChange={e => updateCompound(ci, 'cycle_days', e.target.value)}
                        style={{...is,width:'80px',flex:'none'}}
                      />
                      <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>days</span>
                    </div>
                    <p style={{fontSize:'11px',color:mg,marginTop:'6px'}}>
                      Pattern will shift naturally across weeks. Example: every 3 days from {new Date(startDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})} = {new Date(startDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})}, {new Date(new Date(startDate).getTime()+3*86400000).toLocaleDateString('en-US',{weekday:'short'})}, {new Date(new Date(startDate).getTime()+6*86400000).toLocaleDateString('en-US',{weekday:'short'})}...
                    </p>
                  </div>
                )}

                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>VIALS IN STOCK</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <input type='number' min='0' value={c.vials_in_stock} onChange={e => updateCompound(ci,'vials_in_stock',e.target.value)} placeholder='0' style={{...is,width:'80px',flex:'none'}} />
                    <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>vials</span>
                  </div>
                </div>

                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>NOTES (optional)</label>
                  <textarea value={c.notes} onChange={e => updateCompound(ci,'notes',e.target.value)} placeholder='Goals, context, side effects...' rows={2} style={{...is,resize:'none'}} />
                </div>

                {ci < compounds.length - 1 && <div style={{height:'1px',background:bd,margin:'20px 0'}} />}
              </div>
            ))}

            <button onClick={() => setCompounds([...compounds, newCompound()])} style={{background:'none',border:'1px dashed '+mg,borderRadius:'8px',padding:'10px',width:'100%',color:dg,fontSize:'13px',cursor:'pointer',marginBottom:'16px'}}>+ Add another compound</button>

            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>PROTOCOL START DATE</label>
              <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} style={is} />
            </div>

            {completedProtocols.filter(cp => cp.id !== editingId).length > 0 && (
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>CONTINUING A PREVIOUS PROTOCOL? <span style={{color:mg,fontWeight:'400',textTransform:'none',letterSpacing:0}}>(optional)</span></label>
                <select value={continuedFromId} onChange={e => setContinuedFromId(e.target.value)} style={is}>
                  <option value=''>None</option>
                  {completedProtocols.filter(cp => cp.id !== editingId).map(cp => (
                    <option key={cp.id} value={cp.id}>
                      {cp.name} — {protocolDurationLabel(cp).replace(' protocol','s')}, ended {new Date(cp.completed_date).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                    </option>
                  ))}
                </select>
                <p style={{fontSize:'11px',color:mg,marginTop:'4px'}}>Links this protocol to a completed one — for resuming after a break, or evolving into a new blend. Your history carries over as a badge on the dashboard.</p>
              </div>
            )}

            {error && <div style={{background:'rgba(255,107,107,0.1)',border:'1px solid rgba(255,107,107,0.3)',borderRadius:'8px',padding:'12px',fontSize:'13px',color:'#ff6b6b',marginBottom:'16px'}}>{error}</div>}

            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => {setShowForm(false);setEditingId(null)}} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={save} disabled={saving} style={{flex:2,background:saving?'var(--color-green-20)':g,color:saving?mg:'var(--color-green-text)',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>{saving?'Saving...':editingId?'Save Changes':'Create Protocol'}</button>
            </div>
          </div>
        )}

        {!showForm && completedProtocols.length > 0 && (
          <label style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'20px',cursor:'pointer'}}>
            <input 
              type='checkbox' 
              checked={showCompleted} 
              onChange={e => setShowCompleted(e.target.checked)}
              style={{width:'18px',height:'18px',cursor:'pointer'}}
            />
            <span style={{fontSize:'13px',color:dg,fontWeight:'600'}}>
              Show completed protocols ({completedProtocols.length})
            </span>
          </label>
        )}

        {!showForm && displayProtocols.length === 0 && !showCompleted && (
          <div style={{textAlign:'center',padding:'48px 0'}}>
            <p style={{color:dg,marginBottom:'8px'}}>No protocols yet.</p>
            <p style={{fontSize:'13px',color:mg}}>Tap + New to create your first one.</p>
          </div>
        )}

        {!showForm && displayProtocols.map((p: any) => {
          const isCompleted = p.status === 'completed'
          const isSelected = selectedProtocols.has(p.id)
          return (
            <div key={p.id} style={{
              background:cb,
              border:`1px solid ${isSelected?'#ff6b6b':isCompleted?'#2a2a3a':bd}`,
              borderRadius:'12px',
              padding:'16px',
              marginBottom:'12px',
              opacity:isCompleted?0.6:1,
              position:'relative'
            }}>
              {selectMode && (
                <input
                  type='checkbox'
                  checked={isSelected}
                  onChange={() => toggleProtocolSelect(p.id)}
                  style={{
                    position:'absolute',
                    top:'16px',
                    left:'16px',
                    width:'18px',
                    height:'18px',
                    cursor:'pointer'
                  }}
                />
              )}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px',marginLeft:selectMode?'32px':'0'}}>
                <div>
                  <h2 style={{fontSize:'17px',fontWeight:'700',color:isCompleted?mg:g,marginBottom:'2px'}}>{p.name}</h2>
                  <p style={{fontSize:'12px',color:dg}}>
                    {isCompleted ? `${protocolDurationLabel(p)} · Completed ${new Date(p.completed_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : `Started ${new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`}
                  </p>
                </div>
                {!selectMode && (
                  <div style={{display:'flex',gap:'10px'}}>
                    {!isCompleted && (
                      <>
                        <button onClick={() => setConfirmComplete(p)} style={{background:'none',border:'none',color:'#22c55e',cursor:'pointer',fontSize:'13px',fontWeight:'600'}}>Mark Complete</button>
                        <button onClick={() => startEdit(p)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'13px'}}>Edit</button>
                        <button onClick={() => deleteProtocol(p.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'13px'}}>Delete</button>
                      </>
                    )}
                    {isCompleted && (
                      <div style={{display:'flex',gap:'8px'}}>
                        <button onClick={() => setConfirmReactivate(p)} style={{background:'none',border:'none',color:g,cursor:'pointer',fontSize:'13px',fontWeight:'600'}}>Reactivate</button>
                        <button onClick={() => setConfirmDelete(p)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'13px'}}>Delete</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              {(p.compounds||[]).map((c: any) => {
                const ph = (c.phases||[])[0]
                const freq = ph?.frequency || ''
                const isRolling = freq.startsWith('every') && freq.endsWith('days')
                const days = ph?.days_of_week || []
                const activeDays = DAYS.filter((_,i) => days.includes(DAY_NUMS[i]))
                return (
                  <div key={c.id} style={{background:'var(--color-surface)',borderRadius:'8px',padding:'10px',marginTop:'6px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                      <span style={{fontSize:'14px',fontWeight:'700',color:'var(--color-text)'}}>{c.name}</span>
                      <span style={{fontSize:'12px',color:dg}}>{ph?.dose}{ph?.dose_unit}</span>
                    </div>
                    {isRolling ? (
                      <span style={{fontSize:'11px',fontWeight:'700',color:g,background:'var(--color-green-10)',padding:'2px 8px',borderRadius:'4px',display:'inline-block'}}>
                        Every {freq.replace('every','').replace('days','')} days
                      </span>
                    ) : (
                      <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                        {activeDays.length > 0 ? activeDays.map(d => (
                          <span key={d} style={{fontSize:'10px',fontWeight:'700',color:g,background:'var(--color-green-10)',padding:'2px 6px',borderRadius:'4px'}}>{d}</span>
                        )) : <span style={{fontSize:'11px',color:mg}}>No schedule set</span>}
                        {ph?.time_of_day && <span style={{fontSize:'10px',color:dg,marginLeft:'4px'}}>• {ph.time_of_day}</span>}
                      </div>
                    )}
                    {ph?.duration_weeks && <p style={{fontSize:'11px',color:mg,marginTop:'4px',marginBottom:0}}>{ph.duration_weeks} week protocol</p>}
                  </div>
                )
              })}
            </div>
          )
        })}

        {confirmComplete && (
          <div style={{
            position:'fixed',
            inset:0,
            background:'rgba(0,0,0,0.85)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            zIndex:9999,
            padding:'20px'
          }} onClick={() => setConfirmComplete(null)}>
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
          </div>
        )}

        {confirmDelete && (
          <div style={{
            position:'fixed',
            inset:0,
            background:'rgba(0,0,0,0.85)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            zIndex:9999,
            padding:'20px'
          }} onClick={() => setConfirmDelete(null)}>
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
          </div>
        )}

        {confirmReactivate && (
          <div style={{
            position:'fixed',
            inset:0,
            background:'rgba(0,0,0,0.85)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            zIndex:9999,
            padding:'20px'
          }} onClick={() => setConfirmReactivate(null)}>
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
              <div style={{display:'flex',gap:'10px'}}>
                <button 
                  onClick={() => setConfirmReactivate(null)}
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
                  onClick={reactivateProtocol}
                  style={{
                    flex:1,
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
                  Reactivate
                </button>
              </div>
            </div>
          </div>
        )}

        {confirmBulkDelete && (
          <div style={{
            position:'fixed',
            inset:0,
            background:'rgba(0,0,0,0.85)',
            display:'flex',
            alignItems:'center',
            justifyContent:'center',
            zIndex:9999,
            padding:'20px'
          }} onClick={() => setConfirmBulkDelete(false)}>
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
          </div>
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
