'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

export default function HistoryPage() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [hunger, setHunger] = useState<number | null>(null)
  const [sleep, setSleep] = useState('')
  const [weight, setWeight] = useState('')
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [saving, setSaving] = useState(false)

  const g = '#39ff14'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  function startEdit(e: any) {
    setEditingId(e.id); setDate(e.date); setMood(e.mood); setEnergy(e.energy)
    setSleep(e.sleep?.toString() || ''); setWeight(e.weight?.toString() || '')
    setHunger(e.hunger ?? null); setNotes(e.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() { setEditingId(null) }

  async function saveEdit() {
    setSaving(true)
    const supabase = createClient()
    const row: any = { mood, energy, notes: notes.trim() }
    if (sleep) row.sleep = parseFloat(sleep)
    if (weight) row.weight = parseFloat(weight)
    if (hunger !== null) row.hunger = hunger
    if (date) row.date = date
    await supabase.from('journal_entries').update(row).eq('id', editingId)
    setSaving(false); setEditingId(null); load()
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    const supabase = createClient()
    await supabase.from('journal_entries').delete().eq('id', id)
    load()
  }

  function ScoreBtn({ value, current, onChange, activeColor = g }: { value: number; current: number | null; onChange: (v: number) => void; activeColor?: string }) {
    const isActive = current === value
    return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:isActive?'none':'1px solid '+bd,background:isActive?activeColor:cb,color:isActive?'#000':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{value}</button>
  }

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:g,marginBottom:'4px'}}>History</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'20px'}}>Your past entries. Tap Edit to update.</p>

        {editingId && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'}}>EDIT ENTRY</h2>
            <div style={{marginBottom:'10px'}}>
              <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Date</span>
              <input type='date' value={date} onChange={e => setDate(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box',colorScheme:'dark'}} />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
              <span style={{fontSize:'12px',color:dg}}>Mood</span>
              <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={mood} onChange={setMood} />)}</div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
              <span style={{fontSize:'12px',color:dg}}>Energy</span>
              <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={energy} onChange={setEnergy} activeColor='#f97316' />)}</div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
              <span style={{fontSize:'12px',color:dg}}>Hunger</span>
              <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={hunger} onChange={setHunger} activeColor='#8b5cf6' />)}</div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
              <div><span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Sleep</span><input type='number' step='0.5' value={sleep} onChange={e => setSleep(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box'}} /></div>
              <div><span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Weight</span><input type='number' step='0.1' value={weight} onChange={e => setWeight(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box'}} /></div>
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='Notes...' rows={2} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'13px',boxSizing:'border-box',resize:'none',marginBottom:'12px'}} />
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={cancelEdit} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={saveEdit} disabled={saving} style={{flex:2,background:saving?'#1a3d1a':g,color:saving?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>{saving?'Saving...':'Save Changes'}</button>
            </div>
          </div>
        )}

        {entries.length === 0 && <p style={{color:mg,textAlign:'center',padding:'48px 0'}}>No entries yet. Log your first day from the Dashboard.</p>}
        {entries.map(e => (
          <div key={e.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:g}}>{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={() => startEdit(e)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'12px'}}>Edit</button>
                <button onClick={() => deleteEntry(e.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'12px'}}>Delete</button>
              </div>
            </div>
            <div style={{display:'flex',gap:'12px',fontSize:'12px',color:dg,flexWrap:'wrap'}}>
              {e.mood !== null && <span>Mood {e.mood}</span>}
              {e.energy !== null && <span>· Energy {e.energy}</span>}
              {e.sleep !== null && <span>· Sleep {e.sleep}h</span>}
              {e.weight && <span>· {e.weight}lbs</span>}
              {e.hunger !== null && e.hunger !== undefined && <span>· Hunger {e.hunger}</span>}
            </div>
            {e.notes && <p style={{fontSize:'12px',color:dg,marginTop:'6px'}}>{e.notes}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}