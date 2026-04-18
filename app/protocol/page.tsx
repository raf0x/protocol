'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type Phase = { id?: string; name: string; dose: string; dose_unit: string; syringe_units: string; volume_ml: string; start_week: string; end_week: string; frequency: string; day_of_week: string }
type Compound = { id?: string; name: string; vial_strength: string; vial_unit: string; bac_water_ml: string; notes: string; phases: Phase[] }
type Protocol = { id: string; name: string; notes: string; start_date: string; status: string; compounds: any[] }

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const FREQS = [
  { value: 'daily', label: 'Daily (7x/wk)' },
  { value: '6x/week', label: '6x/week' },
  { value: '5x/week', label: '5x/week' },
  { value: '4x/week', label: '4x/week' },
  { value: '3x/week', label: '3x/week' },
  { value: '2x/week', label: '2x/week' },
  { value: '1x/week', label: '1x/week (weekly)' },
  { value: 'eod', label: 'Every other day' },
  { value: 'every3days', label: 'Every 3 days' },
  { value: 'every4days', label: 'Every 4 days' },
  { value: 'every5days', label: 'Every 5 days' },
]

function newPhase(): Phase { return { name: '', dose: '', dose_unit: 'mg', syringe_units: '', volume_ml: '', start_week: '1', end_week: '1', frequency: '1x/week', day_of_week: '0' } }
function newCompound(): Compound { return { name: '', vial_strength: '', vial_unit: 'mg', bac_water_ml: '', notes: '', phases: [newPhase()] } }

export default function ProtocolPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [protocolName, setProtocolName] = useState('')
  const [notes, setNotes] = useState('')
  const today = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(today)
  const [compounds, setCompounds] = useState<Compound[]>([newCompound()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({})

  const g = '#39ff14'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'

  useEffect(() => { loadProtocols() }, [])

  async function loadProtocols() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('protocols').select('*, compounds(*, phases(*))').order('created_at', { ascending: false })
    setProtocols(data || [])
    setLoading(false)
  }

  function startNew() {
    setEditingId(null)
    setProtocolName('')
    setNotes('')
    setStartDate(today)
    setCompounds([newCompound()])
    setShowForm(true)
    setError('')
  }

  function startEdit(p: any) {
    setEditingId(p.id)
    setProtocolName(p.name)
    setNotes(p.notes || '')
    setStartDate(p.start_date)
    const cs = (p.compounds || []).map((c: any) => ({
      id: c.id,
      name: c.name,
      vial_strength: c.vial_strength?.toString() || '',
      vial_unit: c.vial_unit || 'mg',
      bac_water_ml: c.bac_water_ml?.toString() || '',
      notes: c.notes || '',
      phases: (c.phases || []).sort((a: any, b: any) => a.start_week - b.start_week).map((ph: any) => ({
        id: ph.id,
        name: ph.name,
        dose: ph.dose?.toString() || '',
        dose_unit: ph.dose_unit || 'mg',
        syringe_units: ph.syringe_units?.toString() || '',
        volume_ml: ph.volume_ml?.toString() || '',
        start_week: ph.start_week?.toString() || '1',
        end_week: ph.end_week?.toString() || '1',
        frequency: ph.frequency || '1x/week',
        day_of_week: ph.day_of_week?.toString() || '0'
      }))
    }))
    setCompounds(cs.length ? cs : [newCompound()])
    setShowForm(true)
    setError('')
  }

  function addCompound() { setCompounds([...compounds, newCompound()]) }
  function removeCompound(i: number) { setCompounds(compounds.filter((_, idx) => idx !== i)) }
  function updateCompound(i: number, field: keyof Compound, value: any) {
    const u = [...compounds]; (u[i] as any)[field] = value; setCompounds(u)
  }

  function addPhase(ci: number) {
    const u = [...compounds]
    const lastPhase = u[ci].phases[u[ci].phases.length - 1]
    const nextStart = lastPhase ? (parseInt(lastPhase.end_week) + 1).toString() : '1'
    const newP = { ...newPhase(), start_week: nextStart, end_week: nextStart }
    u[ci].phases.push(newP)
    setCompounds(u)
  }
  function removePhase(ci: number, pi: number) {
    const u = [...compounds]
    u[ci].phases = u[ci].phases.filter((_, idx) => idx !== pi)
    if (u[ci].phases.length === 0) u[ci].phases.push(newPhase())
    setCompounds(u)
  }
  function updatePhase(ci: number, pi: number, field: keyof Phase, value: string) {
    const u = [...compounds]; (u[ci].phases[pi] as any)[field] = value; setCompounds(u)
  }

  async function saveProtocol() {
    setError('')
    if (compounds.some(c => !c.name.trim())) { setError('Every compound needs a name.'); return }
    if (compounds.some(c => c.phases.some(p => !p.dose.trim()))) { setError('Every phase needs a dose.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSaving(false); return }
    const firstName = protocolName.trim() || compounds[0].name.trim()

    let protocolId = editingId
    if (editingId) {
      await supabase.from('protocols').update({ name: firstName, notes: notes.trim(), start_date: startDate }).eq('id', editingId)
      await supabase.from('compounds').delete().eq('protocol_id', editingId)
    } else {
      const { data: p, error: e } = await supabase.from('protocols').insert({ user_id: user.id, name: firstName, notes: notes.trim(), start_date: startDate }).select().single()
      if (e) { setError(e.message); setSaving(false); return }
      protocolId = p.id
    }

    for (let ci = 0; ci < compounds.length; ci++) {
      const c = compounds[ci]
      const { data: ins, error: ce } = await supabase.from('compounds').insert({
        protocol_id: protocolId, user_id: user.id, name: c.name.trim(),
        vial_strength: c.vial_strength ? parseFloat(c.vial_strength) : null,
        vial_unit: c.vial_unit,
        bac_water_ml: c.bac_water_ml ? parseFloat(c.bac_water_ml) : null,
        notes: c.notes.trim(), position: ci
      }).select().single()
      if (ce) { setError(ce.message); setSaving(false); return }
      const compoundId = ins.id
      const phaseRows = c.phases.map((ph, pi) => ({
        compound_id: compoundId, user_id: user.id,
        name: ph.name.trim() || ('Phase ' + (pi + 1)),
        dose: parseFloat(ph.dose),
        dose_unit: ph.dose_unit,
        syringe_units: ph.syringe_units ? parseFloat(ph.syringe_units) : null,
        volume_ml: ph.volume_ml ? parseFloat(ph.volume_ml) : null,
        start_week: parseInt(ph.start_week) || 1,
        end_week: parseInt(ph.end_week) || 1,
        frequency: ph.frequency,
        day_of_week: ph.day_of_week ? parseInt(ph.day_of_week) : null,
        position: pi
      }))
      if (phaseRows.length) await supabase.from('phases').insert(phaseRows)
    }

    setShowForm(false); setEditingId(null); setSaving(false)
    loadProtocols()
  }

  async function deleteProtocol(id: string) {
    const supabase = createClient()
    await supabase.from('protocols').delete().eq('id', id)
    loadProtocols()
  }

  const inputStyle = { width:'100%', background:'#0a0a0f', border:'1px solid '+bd, borderRadius:'6px', padding:'8px 10px', color:'white', fontSize:'14px', boxSizing:'border-box' as const, colorScheme:'dark' as const }
  const smallInputStyle = { ...inputStyle, fontSize:'13px', padding:'6px 8px' }

  return (
    <main style={{minHeight:'100vh',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:g}}>My Protocols</h1>
          {!showForm && <button onClick={startNew} style={{background:g,color:'#000',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>+ New</button>}
        </div>

        {showForm && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'24px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'700',marginBottom:'16px',color:g}}>{editingId ? 'Edit Protocol' : 'New Protocol'}</h2>

            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'4px',fontWeight:'600'}}>PROTOCOL NAME (optional)</label>
              <input value={protocolName} onChange={e => setProtocolName(e.target.value)} placeholder='Auto-fills from first compound' style={inputStyle} />
            </div>

            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'4px',fontWeight:'600'}}>START DATE</label>
              <input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} style={inputStyle} />
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'12px',color:'#ffffff',marginBottom:'10px',fontWeight:'700',letterSpacing:'1px'}}>COMPOUNDS</label>
              {compounds.map((c, ci) => (
                <div key={ci} style={{background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'14px',marginBottom:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                    <span style={{fontSize:'12px',color:mg,fontWeight:'700'}}>COMPOUND {ci + 1}</span>
                    {compounds.length > 1 && <button onClick={() => removeCompound(ci)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'12px'}}>Remove</button>}
                  </div>
                  <input value={c.name} onChange={e => { updateCompound(ci, 'name', e.target.value); if (ci === 0 && (!protocolName || protocolName === compounds[0].name)) setProtocolName(e.target.value) }} placeholder='Compound name (e.g. Retatrutide)' style={{...inputStyle,marginBottom:'8px'}} />
                  <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                    <input type='number' value={c.vial_strength} onChange={e => updateCompound(ci, 'vial_strength', e.target.value)} placeholder='Vial mg' style={smallInputStyle} />
                    <input type='number' value={c.bac_water_ml} onChange={e => updateCompound(ci, 'bac_water_ml', e.target.value)} placeholder='BAC water mL' style={smallInputStyle} />
                  </div>

                  <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid '+bd}}>
                    <span style={{fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px'}}>PHASES</span>
                    {c.phases.map((ph, pi) => (
                      <div key={pi} style={{background:cb,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',marginTop:'8px'}}>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                          <input value={ph.name} onChange={e => updatePhase(ci, pi, 'name', e.target.value)} placeholder={'Phase ' + (pi+1) + ' name'} style={{...smallInputStyle,maxWidth:'160px'}} />
                          {c.phases.length > 1 && <button onClick={() => removePhase(ci, pi)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'11px'}}>×</button>}
                        </div>
                        <label style={{display:'block',fontSize:'10px',color:mg,marginTop:'6px',marginBottom:'2px',fontWeight:'600'}}>DOSE</label>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'6px',marginBottom:'8px'}}>
                          <input type='number' step='0.01' value={ph.dose} onChange={e => updatePhase(ci, pi, 'dose', e.target.value)} placeholder='e.g. 2.5' style={smallInputStyle} />
                          <select value={ph.dose_unit} onChange={e => updatePhase(ci, pi, 'dose_unit', e.target.value)} style={smallInputStyle}>
                            <option value='mg'>mg</option>
                            <option value='mcg'>mcg</option>
                            <option value='IU'>IU</option>
                          </select>
                        </div>
                        <label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',fontWeight:'600'}}>WEEKS</label>
                        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:'6px',marginBottom:'8px',alignItems:'center'}}>
                          <input type='number' min='1' value={ph.start_week} onChange={e => updatePhase(ci, pi, 'start_week', e.target.value)} placeholder='Start' style={smallInputStyle} />
                          <span style={{color:mg,fontSize:'12px'}}>to</span>
                          <input type='number' min='1' value={ph.end_week} onChange={e => updatePhase(ci, pi, 'end_week', e.target.value)} placeholder='End' style={smallInputStyle} />
                        </div>
                        <label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',fontWeight:'600'}}>FREQUENCY</label>
                        <select value={ph.frequency} onChange={e => updatePhase(ci, pi, 'frequency', e.target.value)} style={{...smallInputStyle,marginBottom:'6px'}}>
                          {FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        {(ph.frequency === '1x/week' || ph.frequency === '2x/week') && (
                          <select value={ph.day_of_week} onChange={e => updatePhase(ci, pi, 'day_of_week', e.target.value)} style={{...smallInputStyle,marginBottom:'6px'}}>
                            {DAYS.map((d, i) => <option key={i} value={i}>Inject on {d}</option>)}
                          </select>
                        )}
                        <button type='button' onClick={() => setShowAdvanced({...showAdvanced, [ci+'_'+pi]: !showAdvanced[ci+'_'+pi]})} style={{background:'none',border:'none',color:mg,fontSize:'11px',cursor:'pointer',padding:0,marginTop:'4px',textDecoration:'underline'}}>
                          {showAdvanced[ci+'_'+pi] ? 'Hide advanced' : 'Show advanced (syringe units, volume)'}
                        </button>
                        {showAdvanced[ci+'_'+pi] && (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginTop:'8px'}}>
                            <input type='number' value={ph.syringe_units} onChange={e => updatePhase(ci, pi, 'syringe_units', e.target.value)} placeholder='Syringe units' style={smallInputStyle} />
                            <input type='number' step='0.01' value={ph.volume_ml} onChange={e => updatePhase(ci, pi, 'volume_ml', e.target.value)} placeholder='Volume mL' style={smallInputStyle} />
                          </div>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addPhase(ci)} style={{marginTop:'8px',background:'none',border:'1px dashed '+mg,borderRadius:'6px',padding:'6px 10px',color:dg,fontSize:'12px',cursor:'pointer',width:'100%'}}>+ Add phase</button>
                  </div>
                </div>
              ))}
              <button onClick={addCompound} style={{background:'none',border:'1px dashed '+mg,borderRadius:'8px',padding:'10px',width:'100%',color:dg,fontSize:'13px',cursor:'pointer'}}>+ Add another compound</button>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'4px',fontWeight:'600'}}>NOTES (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='Goals, context, observations...' rows={2} style={{...inputStyle,resize:'none'}} />
            </div>

            {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'12px'}}>{error}</div>}

            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => { setShowForm(false); setError(''); setEditingId(null) }} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={saveProtocol} disabled={saving} style={{flex:2,background:saving?'#1a3d1a':g,color:saving?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':editingId?'Save Changes':'Save Protocol'}</button>
            </div>
          </div>
        )}

        {loading && <p style={{color:mg}}>Loading...</p>}
        {!loading && protocols.length === 0 && !showForm && (
          <div style={{textAlign:'center',padding:'48px 0'}}>
            <p style={{color:dg,marginBottom:'8px'}}>No protocols yet.</p>
            <p style={{color:mg,fontSize:'13px'}}>Tap + New to build your first one with phases.</p>
          </div>
        )}

        {protocols.map((p: any) => {
          const startMs = new Date(p.start_date + 'T00:00:00').getTime()
          const nowMs = Date.now()
          const daysIn = Math.floor((nowMs - startMs) / (86400000))
          const currentWeek = Math.max(1, Math.floor(daysIn / 7) + 1)
          return (
            <div key={p.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                <div>
                  <h2 style={{fontSize:'17px',fontWeight:'700',color:g}}>{p.name}</h2>
                  <p style={{fontSize:'12px',color:mg,marginTop:'2px'}}>Week {currentWeek} · Started {new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</p>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={() => startEdit(p)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'12px'}}>Edit</button>
                  <button onClick={() => deleteProtocol(p.id)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>Delete</button>
                </div>
              </div>
              {p.notes && <p style={{color:dg,fontSize:'13px',marginBottom:'10px'}}>{p.notes}</p>}
              {(p.compounds || []).map((c: any) => (
                <div key={c.id} style={{background:'#0a0a0f',borderRadius:'8px',padding:'10px',marginTop:'8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                    <span style={{fontSize:'14px',fontWeight:'700',color:'white'}}>{c.name}</span>
                    {c.vial_strength && <span style={{fontSize:'11px',color:mg}}>{c.vial_strength}{c.vial_unit} vial · {c.bac_water_ml || '?'}mL BAC</span>}
                  </div>
                  {(c.phases || []).sort((a: any, b: any) => a.start_week - b.start_week).map((ph: any) => {
                    const isCurrent = currentWeek >= ph.start_week && currentWeek <= ph.end_week
                    return (
                      <div key={ph.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:'12px',color:isCurrent?g:dg}}>
                        <span>{isCurrent && '→ '}{ph.name} · W{ph.start_week}-{ph.end_week}</span>
                        <span style={{color:isCurrent?g:mg}}>{ph.dose}{ph.dose_unit}{ph.syringe_units?' · '+ph.syringe_units+'u':''}</span>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </main>
  )
}