'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_NUMS = [1,2,3,4,5,6,0]
const TIMES = ['Morning','Afternoon','Evening','Night']
const UNITS = ['mg','mcg','IU']

type Compound = {
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
    name: '',
    isPreMixed: false,
    vial_strength: '',
    vial_unit: 'mg',
    bac_water_ml: '',
    reconstitution_date: new Date().toISOString().split('T')[0],
    dose: '',
    dose_unit: 'IU',
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

  function startNew() {
    setEditingId(null)
    setStartDate(new Date().toISOString().split('T')[0])
    setCompounds([newCompound()])
    setShowForm(true)
    setError('')
  }

  function startEdit(p: any) {
    setEditingId(p.id)
    setStartDate(p.start_date)
    const cs = (p.compounds || []).map((c: any) => {
      const ph = (c.phases || [])[0]
      const freq = ph?.frequency || ''
      const isRolling = freq.startsWith('every') && freq.endsWith('days')
      const cycleDays = isRolling ? freq.replace('every','').replace('days','') : '3'
      const isPreMixed = !c.vial_strength && !c.bac_water_ml && !c.reconstitution_date
      
      return {
        name: c.name,
        isPreMixed,
        vial_strength: c.vial_strength?.toString() || '',
        vial_unit: c.vial_unit || 'mg',
        bac_water_ml: c.bac_water_ml?.toString() || '',
        reconstitution_date: c.reconstitution_date || new Date().toISOString().split('T')[0],
        dose: ph?.dose?.toString() || '',
        dose_unit: ph?.dose_unit || 'IU',
        duration_weeks: ph?.duration_weeks?.toString() || ph?.end_week?.toString() || '12',
        frequency_mode: isRolling ? 'rolling' : 'weekly',
        days_of_week: ph?.days_of_week || [],
        cycle_days: cycleDays,
        time_of_day: ph?.time_of_day || 'Morning',
        vials_in_stock: c.vials_in_stock?.toString() || '',
        notes: c.notes || '',
      }
    })
    setCompounds(cs.length ? cs : [newCompound()])
    setShowForm(true)
    setError('')
  }

  function updateCompound(i: number, field: string, value: any) {
    const u = [...compounds]
    ;(u[i] as any)[field] = value
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
    
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in.'); setSaving(false); return }
    const pName = compounds[0].name.trim()
    let protocolId = editingId
    
    let trackingData: Record<string, any> = {}
    if (editingId) {
      const { data: existing } = await supabase.from('compounds').select('name, ml_per_dose, doses_taken_override').eq('protocol_id', editingId)
      if (existing) {
        existing.forEach((c: any) => {
          trackingData[c.name] = {
            ml_per_dose: c.ml_per_dose,
            doses_taken_override: c.doses_taken_override
          }
        })
      }
      await supabase.from('protocols').update({ name: pName, start_date: startDate }).eq('id', editingId)
      await supabase.from('compounds').delete().eq('protocol_id', editingId)
    } else {
      const { data: p, error: e } = await supabase.from('protocols').insert({ user_id: user.id, name: pName, start_date: startDate }).select().single()
      if (e) { setError(e.message); setSaving(false); return }
      protocolId = p.id
    }
    
    for (let ci = 0; ci < compounds.length; ci++) {
      const c = compounds[ci]
      const saved = trackingData[c.name.trim()] || {}
      
      const { data: ins } = await supabase.from('compounds').insert({
        protocol_id: protocolId,
        user_id: user.id,
        name: c.name.trim(),
        vial_strength: c.isPreMixed ? null : (c.vial_strength ? parseFloat(c.vial_strength) : null),
        vial_unit: c.isPreMixed ? null : c.vial_unit,
        bac_water_ml: c.isPreMixed ? null : (c.bac_water_ml ? parseFloat(c.bac_water_ml) : null),
        reconstitution_date: c.isPreMixed ? null : c.reconstitution_date,
        notes: c.notes.trim(),
        vials_in_stock: c.vials_in_stock ? parseInt(c.vials_in_stock) : null,
        ml_per_dose: saved.ml_per_dose ?? null,
        doses_taken_override: saved.doses_taken_override ?? null,
        position: ci
      }).select().single()
      if (!ins) continue
      
      let frequency: string
      let daysOfWeek: number[]
      
      if (c.frequency_mode === 'rolling') {
        const cycle = parseInt(c.cycle_days)
        frequency = `every${cycle}days`
        daysOfWeek = []
      } else {
        const daysCount = c.days_of_week.length
        const freqMap: Record<number,string> = {1:'1x/week',2:'2x/week',3:'3x/week',4:'4x/week',5:'5x/week',6:'6x/week',7:'daily'}
        frequency = freqMap[daysCount] || '1x/week'
        daysOfWeek = c.days_of_week
      }
      
      await supabase.from('phases').insert({
        compound_id: ins.id,
        user_id: user.id,
        name: 'Phase 1',
        dose: parseFloat(c.dose),
        dose_unit: c.dose_unit,
        start_week: 1,
        end_week: parseInt(c.duration_weeks) || 12,
        frequency,
        day_of_week: daysOfWeek[0] ?? null,
        days_of_week: daysOfWeek,
        time_of_day: c.time_of_day.toLowerCase(),
        duration_weeks: parseInt(c.duration_weeks) || 12,
        position: 0
      })
    }
    
    if (!editingId) {
      await supabase.from('protocol_events').insert({ user_id: user.id, protocol_id: protocolId, date: startDate, event_type: 'started', description: 'Started ' + pName })
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    load()
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
                    <button onClick={() => setCompounds(compounds.filter((_,i) => i!==ci))} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'12px'}}>Remove</button>
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
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
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

                <div style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>DOSE PER INJECTION</label>
                  <div style={{display:'flex',gap:'6px'}}>
                    <input type='number' step='any' value={c.dose} onChange={e => updateCompound(ci,'dose',e.target.value)} placeholder='e.g. 60' style={{...is,flex:1}} />
                    <select value={c.dose_unit} onChange={e => updateCompound(ci,'dose_unit',e.target.value)} style={{...is,width:'75px',flex:'none'}}>
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px',marginBottom:'6px'}}>PROTOCOL DURATION</label>
                  <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                    <input type='number' min='1' max='52' value={c.duration_weeks} onChange={e => updateCompound(ci,'duration_weeks',e.target.value)} style={{...is,width:'80px',flex:'none'}} />
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
                    {isCompleted ? `Completed ${new Date(p.completed_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}` : `Started ${new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`}
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
