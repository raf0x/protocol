'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type Compound = { name: string; dose: string; unit: string; frequency: string }
type Protocol = { id: string; name: string; notes: string; compounds: Compound[] }

export default function ProtocolPage() {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [protocolName, setProtocolName] = useState('')
  const [notes, setNotes] = useState('')
  const [compounds, setCompounds] = useState<Compound[]>([{ name: '', dose: '', unit: 'mcg', frequency: 'daily' }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadProtocols() }, [])

  async function loadProtocols() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('protocols').select('*, compounds(*)').order('created_at', { ascending: false })
    setProtocols(data || [])
    setLoading(false)
  }

  function addCompound() { setCompounds([...compounds, { name: '', dose: '', unit: 'mcg', frequency: 'daily' }]) }
  function updateCompound(index: number, field: keyof Compound, value: string) { const u = [...compounds]; u[index][field] = value; setCompounds(u) }
  function removeCompound(index: number) { setCompounds(compounds.filter((_, i) => i !== index)) }

  async function saveProtocol() {
    setError('')
    if (!protocolName.trim()) { setError('Please give your protocol a name.'); return }
    if (compounds.some(c => !c.name.trim() || !c.dose.trim())) { setError('Please fill in the name and dose for every compound.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSaving(false); return }
    const { data: protocol, error: pe } = await supabase.from('protocols').insert({ name: protocolName.trim(), notes: notes.trim(), user_id: user.id }).select().single()
    if (pe) { setError(pe.message); setSaving(false); return }
    const rows = compounds.map(c => ({ protocol_id: protocol.id, user_id: user.id, name: c.name.trim(), dose: parseFloat(c.dose), unit: c.unit, frequency: c.frequency }))
    const { error: ce } = await supabase.from('compounds').insert(rows)
    if (ce) { setError(ce.message); setSaving(false); return }
    setProtocolName(''); setNotes(''); setCompounds([{ name: '', dose: '', unit: 'mcg', frequency: 'daily' }]); setShowForm(false); setSaving(false)
    loadProtocols()
  }

  async function deleteProtocol(id: string) {
    const supabase = createClient()
    await supabase.from('protocols').delete().eq('id', id)
    loadProtocols()
  }

  const inputStyle = {width:'100%',background:'#000000',border:'1px solid #1a1a1a',borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box' as const}
  const selectStyle = {background:'#000000',border:'1px solid #1a1a1a',borderRadius:'4px',padding:'6px 8px',color:'white',fontSize:'13px'}

  return (
    <main style={{minHeight:'100vh',background:'#000000',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:'#39ff14'}}>My Protocols</h1>
          {!showForm && <button onClick={() => setShowForm(true)} style={{background:'#39ff14',color:'#000000',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>+ New</button>}
        </div>

        {showForm && (
          <div style={{background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:'8px',padding:'20px',marginBottom:'24px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'16px',color:'#39ff14'}}>New Protocol</h2>
            <div style={{marginBottom:'12px'}}>
              <label style={{display:'block',fontSize:'13px',color:'#4dbd4d',marginBottom:'4px'}}>Protocol name</label>
              <input value={protocolName} onChange={e => setProtocolName(e.target.value)} placeholder='e.g. BPC-157 healing cycle' style={inputStyle} />
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:'#4dbd4d',marginBottom:'4px'}}>Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='Goals, context, cycle length...' rows={2} style={{...inputStyle,resize:'none'}} />
            </div>
            <div style={{marginBottom:'12px'}}>
              <label style={{display:'block',fontSize:'13px',color:'#4dbd4d',marginBottom:'8px'}}>Compounds</label>
              {compounds.map((compound, index) => (
                <div key={index} style={{background:'#000000',border:'1px solid #1a1a1a',borderRadius:'6px',padding:'12px',marginBottom:'8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
                    <span style={{fontSize:'12px',color:'#2d5a2d'}}>Compound {index + 1}</span>
                    {compounds.length > 1 && <button onClick={() => removeCompound(index)} style={{background:'none',border:'none',color:'#ff4444',cursor:'pointer',fontSize:'12px'}}>Remove</button>}
                  </div>
                  <input value={compound.name} onChange={e => updateCompound(index, 'name', e.target.value)} placeholder='Compound name (e.g. BPC-157)' style={{...inputStyle,marginBottom:'6px'}} />
                  <div style={{display:'flex',gap:'6px'}}>
                    <input type='number' value={compound.dose} onChange={e => updateCompound(index, 'dose', e.target.value)} placeholder='Dose' style={{flex:1,background:'#000000',border:'1px solid #1a1a1a',borderRadius:'4px',padding:'6px 8px',color:'white',fontSize:'13px'}} />
                    <select value={compound.unit} onChange={e => updateCompound(index, 'unit', e.target.value)} style={selectStyle}>
                      <option value='mcg'>mcg</option>
                      <option value='mg'>mg</option>
                      <option value='IU'>IU</option>
                      <option value='ml'>ml</option>
                    </select>
                    <select value={compound.frequency} onChange={e => updateCompound(index, 'frequency', e.target.value)} style={selectStyle}>
                      <option value='daily'>Daily</option>
                      <option value='eod'>Every other day</option>
                      <option value='3x/week'>3x per week</option>
                      <option value='weekly'>Weekly</option>
                    </select>
                  </div>
                </div>
              ))}
              <button onClick={addCompound} style={{background:'none',border:'1px dashed #1a3d1a',borderRadius:'6px',padding:'8px',width:'100%',color:'#2d5a2d',fontSize:'13px',cursor:'pointer'}}>+ Add another compound</button>
            </div>
            {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'12px'}}>{error}</div>}
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => { setShowForm(false); setError('') }} style={{flex:1,background:'#0d0d0d',color:'#4dbd4d',border:'1px solid #1a1a1a',borderRadius:'6px',padding:'10px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={saveProtocol} disabled={saving} style={{flex:2,background:saving?'#1a3d1a':'#39ff14',color:saving?'#2d5a2d':'#000000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':'Save Protocol'}</button>
            </div>
          </div>
        )}

        {loading && <p style={{color:'#2d5a2d',fontSize:'14px'}}>Loading...</p>}
        {!loading && protocols.length === 0 && !showForm && (
          <div style={{textAlign:'center',padding:'48px 0'}}>
            <p style={{color:'#4dbd4d',marginBottom:'8px'}}>No protocols yet.</p>
            <p style={{color:'#2d5a2d',fontSize:'13px'}}>Tap + New to create your first one.</p>
          </div>
        )}

        {protocols.map((protocol: any) => (
          <div key={protocol.id} style={{background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:'8px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <h2 style={{fontSize:'16px',fontWeight:'600',color:'#39ff14'}}>{protocol.name}</h2>
              <button onClick={() => deleteProtocol(protocol.id)} style={{background:'none',border:'none',color:'#2d5a2d',cursor:'pointer',fontSize:'12px'}}>Delete</button>
            </div>
            {protocol.notes && <p style={{color:'#4dbd4d',fontSize:'13px',marginBottom:'10px'}}>{protocol.notes}</p>}
            {protocol.compounds && protocol.compounds.map((c: any, i: number) => (
              <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderTop:'1px solid #1a1a1a'}}>
                <span style={{fontSize:'13px'}}>{c.name}</span>
                <span style={{fontSize:'13px',color:'#4dbd4d'}}>{c.dose} {c.unit} — {c.frequency}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  )
}