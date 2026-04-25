'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../lib/supabase'
import { useRouter } from 'next/navigation'

type Phase = { name: string; dose: string; dose_unit: string; start_week: string; end_week: string; frequency: string; day_of_week: string }
type Compound = { name: string; vial_strength: string; vial_unit: string; bac_water_ml: string; reconstitution_date: string; phases: Phase[] }

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const FREQS = [
  { value: 'daily', label: 'Daily' }, { value: '6x/week', label: '6x/week' }, { value: '5x/week', label: '5x/week' },
  { value: '4x/week', label: '4x/week' }, { value: '3x/week', label: '3x/week' }, { value: '2x/week', label: '2x/week' },
  { value: '1x/week', label: 'Weekly' }, { value: 'eod', label: 'Every other day' },
  { value: 'every3days', label: 'Every 3 days' }, { value: 'every4days', label: 'Every 4 days' }, { value: 'every5days', label: 'Every 5 days' },
]

function newPhase(): Phase { return { name: '', dose: '', dose_unit: 'mg', start_week: '1', end_week: '4', frequency: '1x/week', day_of_week: '0' } }
function newCompound(): Compound { const t = new Date().toISOString().split('T')[0]; return { name: '', vial_strength: '', vial_unit: 'mg', bac_water_ml: '', reconstitution_date: t, phases: [newPhase()] } }

export default function ManagePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [protocols, setProtocols] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [compounds, setCompounds] = useState<Compound[]>([newCompound()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const g = 'var(--color-green)', dg = '#8b8ba7', mg = '#3d3d5c', cb = '#12121a', bd = '#1e1e2e'

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

  function startNew() { setEditingId(null); setNotes(''); setStartDate(new Date().toISOString().split('T')[0]); setCompounds([newCompound()]); setShowForm(true); setError('') }

  function startEdit(p: any) {
    setEditingId(p.id); setNotes(p.notes || ''); setStartDate(p.start_date)
    const cs = (p.compounds || []).map((c: any) => ({
      name: c.name, vial_strength: c.vial_strength?.toString() || '', vial_unit: c.vial_unit || 'mg',
      bac_water_ml: c.bac_water_ml?.toString() || '', reconstitution_date: c.reconstitution_date || new Date().toISOString().split('T')[0],
      phases: (c.phases || []).sort((a: any, b: any) => a.start_week - b.start_week).map((ph: any) => ({
        name: ph.name, dose: ph.dose?.toString() || '', dose_unit: ph.dose_unit || 'mg',
        start_week: ph.start_week?.toString() || '1', end_week: ph.end_week?.toString() || '1',
        frequency: ph.frequency || '1x/week', day_of_week: ph.day_of_week?.toString() || '0'
      }))
    }))
    setCompounds(cs.length ? cs : [newCompound()]); setShowForm(true); setError('')
  }

  function addCompound() { setCompounds([...compounds, newCompound()]) }
  function removeCompound(i: number) { setCompounds(compounds.filter((_, idx) => idx !== i)) }
  function updateCompound(i: number, f: string, v: any) { const u = [...compounds]; (u[i] as any)[f] = v; setCompounds(u) }
  function addPhase(ci: number) { const u = [...compounds]; const last = u[ci].phases[u[ci].phases.length-1]; u[ci].phases.push({...newPhase(), start_week: last ? (parseInt(last.end_week)+1).toString() : '1', end_week: last ? (parseInt(last.end_week)+1).toString() : '1'}); setCompounds(u) }
  function removePhase(ci: number, pi: number) { const u = [...compounds]; u[ci].phases = u[ci].phases.filter((_,i) => i!==pi); if (!u[ci].phases.length) u[ci].phases.push(newPhase()); setCompounds(u) }
  function updatePhase(ci: number, pi: number, f: string, v: string) { const u = [...compounds]; (u[ci].phases[pi] as any)[f] = v; setCompounds(u) }

  async function save() {
    setError('')
    if (compounds.some(c => !c.name.trim())) { setError('Every compound needs a name.'); return }
    if (compounds.some(c => c.phases.some(p => !p.dose.trim()))) { setError('Every phase needs a dose.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in.'); setSaving(false); return }
    const pName = compounds[0].name.trim()
    let protocolId = editingId
    if (editingId) {
      await supabase.from('protocols').update({ name: pName, notes: notes.trim(), start_date: startDate }).eq('id', editingId)
      await supabase.from('compounds').delete().eq('protocol_id', editingId)
    } else {
      const { data: p, error: e } = await supabase.from('protocols').insert({ user_id: user.id, name: pName, notes: notes.trim(), start_date: startDate }).select().single()
      if (e) { setError(e.message); setSaving(false); return }
      protocolId = p.id
    }
    for (let ci = 0; ci < compounds.length; ci++) {
      const c = compounds[ci]
      const { data: ins } = await supabase.from('compounds').insert({ protocol_id: protocolId, user_id: user.id, name: c.name.trim(), vial_strength: c.vial_strength ? parseFloat(c.vial_strength) : null, vial_unit: c.vial_unit, bac_water_ml: c.bac_water_ml ? parseFloat(c.bac_water_ml) : null, reconstitution_date: c.reconstitution_date || null, position: ci }).select().single()
      if (!ins) continue
      const rows = c.phases.map((ph, pi) => ({ compound_id: ins.id, user_id: user.id, name: ph.name.trim() || ('Phase '+(pi+1)), dose: parseFloat(ph.dose), dose_unit: ph.dose_unit, start_week: parseInt(ph.start_week)||1, end_week: parseInt(ph.end_week)||1, frequency: ph.frequency, day_of_week: (ph.frequency==='1x/week'||ph.frequency==='2x/week') ? parseInt(ph.day_of_week) : null, position: pi }))
      if (rows.length) await supabase.from('phases').insert(rows)
    }
    if (!editingId) {
      await supabase.from('protocol_events').insert({ user_id: user.id, protocol_id: protocolId, date: startDate, event_type: 'started', description: 'Started ' + pName })
    }
    setSaving(false); setShowForm(false); setEditingId(null); load()
  }

  async function deleteProtocol(id: string) {
    if (!confirm('Delete this protocol and all its data?')) return
    const supabase = createClient()
    await supabase.from('protocols').delete().eq('id', id)
    load()
  }

  const is = { width:'100%', background:'var(--color-bg)', border:'1px solid '+bd, borderRadius:'6px', padding:'8px 10px', color:'var(--color-text)', fontSize:'14px', boxSizing:'border-box' as const, colorScheme:'dark' as const }
  const ss = { ...is, fontSize:'13px', padding:'6px 8px' }

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',color:'var(--color-text)',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <button onClick={() => router.push('/protocol')} style={{background:'none',border:'none',color:dg,fontSize:'13px',cursor:'pointer',padding:0,marginBottom:'14px'}}>← Dashboard</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:g}}>Manage Protocols</h1>
          {!showForm && <button onClick={startNew} style={{background:g,color:'#000',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>+ New</button>}
        </div>

        {showForm && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'24px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'700',marginBottom:'16px',color:g}}>{editingId ? 'Edit Protocol' : 'New Protocol'}</h2>
            <div style={{marginBottom:'10px'}}><label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'4px',fontWeight:'600'}}>START DATE</label><input type='date' value={startDate} onChange={e => setStartDate(e.target.value)} style={is} /></div>
            <label style={{display:'block',fontSize:'12px',color:'var(--color-text)',marginBottom:'10px',fontWeight:'700',letterSpacing:'1px'}}>COMPOUNDS</label>
            {compounds.map((c, ci) => (
              <div key={ci} style={{background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'8px',padding:'14px',marginBottom:'10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{fontSize:'12px',color:mg,fontWeight:'700'}}>COMPOUND {ci+1}</span>{compounds.length>1 && <button onClick={() => removeCompound(ci)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'12px'}}>Remove</button>}</div>
                <input value={c.name} onChange={e => updateCompound(ci,'name',e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{...is,marginBottom:'6px'}} />
                <div style={{display:'flex',gap:'6px',marginBottom:'6px'}}><input type='number' value={c.vial_strength} onChange={e => updateCompound(ci,'vial_strength',e.target.value)} placeholder='Vial mg' style={ss} /><input type='number' value={c.bac_water_ml} onChange={e => updateCompound(ci,'bac_water_ml',e.target.value)} placeholder='BAC water mL' style={ss} /></div>
                <div style={{marginBottom:'6px'}}><label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'4px'}}>Reconstitution date</label><input type='date' value={c.reconstitution_date} onChange={e => updateCompound(ci,'reconstitution_date',e.target.value)} style={ss} /></div>
                <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid '+bd}}><span style={{fontSize:'11px',color:dg,fontWeight:'700',letterSpacing:'1px'}}>PHASES</span>
                  {c.phases.map((ph, pi) => (
                    <div key={pi} style={{background:cb,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',marginTop:'8px'}}>
                      <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}><input value={ph.name} onChange={e => updatePhase(ci,pi,'name',e.target.value)} placeholder={'Phase '+(pi+1)} style={{...ss,maxWidth:'140px'}} />{c.phases.length>1 && <button onClick={() => removePhase(ci,pi)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'11px'}}>×</button>}</div>
                      <label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',fontWeight:'600'}}>DOSE</label>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'6px',marginBottom:'6px'}}><input type='number' step='0.01' value={ph.dose} onChange={e => updatePhase(ci,pi,'dose',e.target.value)} placeholder='e.g. 2.5' style={ss} /><select value={ph.dose_unit} onChange={e => updatePhase(ci,pi,'dose_unit',e.target.value)} style={ss}><option value='mg'>mg</option><option value='mcg'>mcg</option><option value='IU'>IU</option></select></div>
                      <label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',fontWeight:'600'}}>WEEKS</label>
                      <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:'6px',marginBottom:'6px',alignItems:'center'}}><input type='number' min='1' value={ph.start_week} onChange={e => updatePhase(ci,pi,'start_week',e.target.value)} placeholder='Start' style={ss} /><span style={{color:mg,fontSize:'12px'}}>to</span><input type='number' min='1' value={ph.end_week} onChange={e => updatePhase(ci,pi,'end_week',e.target.value)} placeholder='End' style={ss} /></div>
                      <label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',fontWeight:'600'}}>FREQUENCY</label>
                      <select value={ph.frequency} onChange={e => updatePhase(ci,pi,'frequency',e.target.value)} style={{...ss,marginBottom:'6px'}}>{FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
                      {(ph.frequency==='1x/week'||ph.frequency==='2x/week') && <select value={ph.day_of_week} onChange={e => updatePhase(ci,pi,'day_of_week',e.target.value)} style={ss}>{DAYS.map((d,i) => <option key={i} value={i}>Inject on {d}</option>)}</select>}
                    </div>))}
                  <button onClick={() => addPhase(ci)} style={{marginTop:'8px',background:'none',border:'1px dashed '+mg,borderRadius:'6px',padding:'6px',color:dg,fontSize:'12px',cursor:'pointer',width:'100%'}}>+ Add phase</button>
                </div>
              </div>))}
            <button onClick={addCompound} style={{background:'none',border:'1px dashed '+mg,borderRadius:'8px',padding:'10px',width:'100%',color:dg,fontSize:'13px',cursor:'pointer',marginBottom:'16px'}}>+ Add another compound</button>
            <div style={{marginBottom:'16px'}}><label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'4px',fontWeight:'600'}}>NOTES (optional)</label><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='Goals, context...' rows={2} style={{...is,resize:'none'}} /></div>
            {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'12px'}}>{error}</div>}
            <div style={{display:'flex',gap:'8px'}}><button onClick={() => {setShowForm(false);setEditingId(null)}} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'14px',cursor:'pointer'}}>Cancel</button><button onClick={save} disabled={saving} style={{flex:2,background:saving?'#1a3d1a':g,color:saving?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>{saving?'Saving...':editingId?'Save Changes':'Create Protocol'}</button></div>
          </div>)}

        {!showForm && protocols.length === 0 && <div style={{textAlign:'center',padding:'48px 0'}}><p style={{color:dg}}>No protocols yet.</p><p style={{color:mg,fontSize:'13px'}}>Tap + New to create your first one.</p></div>}

        {!showForm && protocols.map((p: any) => (
          <div key={p.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div><h2 style={{fontSize:'17px',fontWeight:'700',color:g}}>{p.name}</h2><p style={{fontSize:'12px',color:dg,marginTop:'2px'}}>Started {new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p></div>
              <div style={{display:'flex',gap:'10px'}}><button onClick={() => startEdit(p)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'13px'}}>Edit</button><button onClick={() => deleteProtocol(p.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'13px'}}>Delete</button></div>
            </div>
            {p.notes && <p style={{color:dg,fontSize:'13px',marginBottom:'8px'}}>{p.notes}</p>}
            {(p.compounds||[]).map((c: any) => (
              <div key={c.id} style={{background:'var(--color-bg)',borderRadius:'8px',padding:'10px',marginTop:'6px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'14px',fontWeight:'700',color:'var(--color-text)'}}>{c.name}</span>{c.vial_strength && <span style={{fontSize:'11px',color:dg}}>{c.vial_strength}{c.vial_unit} · {c.bac_water_ml||'?'}mL BAC</span>}</div>
                {(c.phases||[]).sort((a:any,b:any)=>a.start_week-b.start_week).map((ph:any) => (
                  <div key={ph.id} style={{display:'flex',justifyContent:'space-between',padding:'4px 0',fontSize:'12px',color:dg}}><span>{ph.name} · W{ph.start_week}-{ph.end_week}</span><span>{ph.dose}{ph.dose_unit} · {ph.frequency}</span></div>))}
              </div>))}
          </div>))}
      </div>
    </main>)
}