'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type JournalEntry = { id: string; date: string; mood: number | null; energy: number | null; sleep: number | null; notes: string; weight?: number; hunger?: number }
type DueCompound = { id: string; name: string; dose: string; protocol_name: string }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null): boolean {
  if (!protocolStart) return false
  const start = new Date(protocolStart + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)
  if (daysDiff < 0) return false
  if (frequency === 'daily') return true
  if (frequency === 'eod') return daysDiff % 2 === 0
  if (frequency === 'every3days') return daysDiff % 3 === 0
  if (frequency === 'every4days') return daysDiff % 4 === 0
  if (frequency === 'every5days') return daysDiff % 5 === 0
  const todayDay = today.getDay()
  if (frequency === '1x/week') return dayOfWeek !== null ? todayDay === dayOfWeek : daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = dayOfWeek ?? 0; return todayDay === d || todayDay === (d+3)%7 }
  if (frequency === '3x/week') return todayDay === 1 || todayDay === 3 || todayDay === 5
  if (frequency === '4x/week') return todayDay === 1 || todayDay === 2 || todayDay === 4 || todayDay === 5
  if (frequency === '5x/week') return todayDay >= 1 && todayDay <= 5
  if (frequency === '6x/week') return todayDay !== 0
  return false
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [mood, setMood] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [sleep, setSleep] = useState('')
  const [weight, setWeight] = useState('')
  const [hunger, setHunger] = useState<number | null>(null)
  const [entryNotes, setEntryNotes] = useState('')

  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])
  const [logs, setLogs] = useState<Record<string, LogEntry>>({})

  const g = '#39ff14'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data: js } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })
    setEntries(js || [])
    const todayEntry = (js || []).find((e: any) => e.date === today)
    if (todayEntry) {
      setMood(todayEntry.mood); setEnergy(todayEntry.energy);
      setSleep(todayEntry.sleep?.toString() || '')
      setWeight(todayEntry.weight?.toString() || '')
      setHunger(todayEntry.hunger ?? null)
      setEntryNotes(todayEntry.notes || '')
    }
    const { data: protocols } = await supabase.from('protocols').select('id, start_date, name, compounds(id, name, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week))').eq('status', 'active')
    const due: DueCompound[] = []
    ;(protocols || []).forEach((p: any) => {
      const startMs = new Date(p.start_date + 'T00:00:00').getTime()
      const daysIn = Math.floor((Date.now() - startMs) / 86400000)
      const currentWeek = Math.max(1, Math.floor(daysIn / 7) + 1)
      ;(p.compounds || []).forEach((c: any) => {
        const phase = (c.phases || []).find((ph: any) => currentWeek >= ph.start_week && currentWeek <= ph.end_week) || c.phases?.[0]
        if (!phase) return
        if (isDueToday(phase.frequency, p.start_date, phase.day_of_week)) {
          due.push({ id: c.id, name: c.name, dose: phase.dose + phase.dose_unit, protocol_name: p.name })
        }
      })
    })
    setDueCompounds(due)
    const { data: ls } = await supabase.from('injection_logs').select('*').eq('date', today)
    const map: Record<string, LogEntry> = {}
    ;(ls || []).forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } })
    setLogs(map)
    setLoading(false)
  }

  async function toggleInjection(compoundId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const current = logs[compoundId]
    const newTaken = !current?.taken
    await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: compoundId, date: today, taken: newTaken, discomfort: current?.discomfort || 0 }, { onConflict: 'user_id,compound_id,date' })
    setLogs({ ...logs, [compoundId]: { compound_id: compoundId, taken: newTaken, discomfort: current?.discomfort || 0 } })
  }

  async function setDiscomfort(compoundId: string, level: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: compoundId, date: today, taken: true, discomfort: level }, { onConflict: 'user_id,compound_id,date' })
    setLogs({ ...logs, [compoundId]: { compound_id: compoundId, taken: true, discomfort: level } })
  }

  async function saveEntry() {
    setError(''); setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in.'); setSaving(false); return }
    const row: any = { user_id: user.id, date, notes: entryNotes.trim() }
    if (mood !== null) row.mood = mood
    if (energy !== null) row.energy = energy
    if (sleep) row.sleep = parseFloat(sleep)
    if (weight) row.weight = parseFloat(weight)
    if (hunger !== null) row.hunger = hunger
    const { error: e } = await supabase.from('journal_entries').upsert(row, { onConflict: 'user_id,date' })
    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false)
    loadAll()
  }

  function ScoreBtn({ value, current, onChange, activeColor = g }: { value: number; current: number | null; onChange: (v: number) => void; activeColor?: string }) {
    const isActive = current === value
    return <button onClick={() => onChange(value)} style={{width:'42px',height:'42px',borderRadius:'50%',border:isActive?'none':'1px solid '+bd,background:isActive?activeColor:cb,color:isActive?'#000':dg,fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>{value}</button>
  }

  function DiscomfortBtn({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) {
    const isActive = current === value
    const color = value === 0 ? g : '#ff6b6b'
    return <button onClick={() => onChange(value)} style={{width:'32px',height:'32px',borderRadius:'6px',border:'1px solid '+(isActive?color:bd),background:isActive?(value===0?'rgba(57,255,20,0.15)':'rgba(255,107,107,0.15)'):'transparent',color:isActive?color:dg,fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{value}</button>
  }

  const inputStyle = { width:'100%', background:'#0a0a0f', border:'1px solid '+bd, borderRadius:'6px', padding:'8px 10px', color:'white', fontSize:'14px', boxSizing:'border-box' as const, colorScheme:'dark' as const }

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:g,marginBottom:'8px'}}>Journal</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'20px'}}>Log your day. Track your progress.</p>

        {/* Today's injections */}
        {dueCompounds.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
              <span style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>TODAY'S INJECTIONS</span>
              <span style={{fontSize:'12px',color:mg}}>{Object.values(logs).filter(l => l.taken).length}/{dueCompounds.length}</span>
            </div>
            {dueCompounds.map(c => {
              const log = logs[c.id]
              const taken = log?.taken || false
              const discomfort = log?.discomfort || 0
              return (
                <div key={c.id} style={{background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    <button onClick={() => toggleInjection(c.id)} style={{width:'26px',height:'26px',borderRadius:'6px',border:'1px solid '+(taken?g:bd),background:taken?g:'transparent',cursor:'pointer',color:'#000',fontWeight:'800',padding:0}}>{taken?'✓':''}</button>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'14px',fontWeight:'600',color:taken?dg:'white',textDecoration:taken?'line-through':'none'}}>{c.name}</div>
                      <div style={{fontSize:'11px',color:mg}}>{c.dose} · {c.protocol_name}</div>
                    </div>
                  </div>
                  {taken && (
                    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid '+bd}}>
                      <span style={{fontSize:'10px',color:mg,display:'block',marginBottom:'6px',letterSpacing:'1px'}}>DISCOMFORT (0 = none)</span>
                      <div style={{display:'flex',gap:'6px'}}>
                        {[0,1,2,3,4,5].map(n => <DiscomfortBtn key={n} value={n} current={discomfort} onChange={v => setDiscomfort(c.id, v)} />)}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Daily log */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'16px'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'16px'}}>HOW ARE YOU TODAY?</h2>

          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'6px'}}>Date</label>
            <input type='date' value={date} onChange={e => setDate(e.target.value)} style={inputStyle} />
          </div>

          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'8px'}}>Mood</label>
            <div style={{display:'flex',gap:'8px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={mood} onChange={setMood} />)}</div>
          </div>

          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'8px'}}>Energy</label>
            <div style={{display:'flex',gap:'8px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={energy} onChange={setEnergy} activeColor='#f59e0b' />)}</div>
          </div>

          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'8px'}}>Hunger (1 = suppressed, 5 = ravenous)</label>
            <div style={{display:'flex',gap:'8px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={hunger} onChange={setHunger} activeColor='#8b5cf6' />)}</div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'16px'}}>
            <div>
              <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'6px'}}>Sleep (hrs)</label>
              <input type='number' step='0.5' value={sleep} onChange={e => setSleep(e.target.value)} placeholder='e.g. 7.5' style={inputStyle} />
            </div>
            <div>
              <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'6px'}}>Weight (lbs)</label>
              <input type='number' step='0.1' value={weight} onChange={e => setWeight(e.target.value)} placeholder='optional' style={inputStyle} />
            </div>
          </div>

          <div style={{marginBottom:'16px'}}>
            <label style={{display:'block',fontSize:'12px',color:dg,marginBottom:'6px'}}>Notes</label>
            <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder='How do you feel? Any observations...' rows={3} style={{...inputStyle,resize:'none'}} />
          </div>

          {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'12px'}}>{error}</div>}

          <button onClick={saveEntry} disabled={saving} style={{width:'100%',background:saving?'#1a3d1a':g,color:saving?mg:'#000',border:'none',borderRadius:'6px',padding:'12px',fontSize:'14px',fontWeight:'700',cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':'Save Entry'}</button>
        </div>

        {/* Recent entries */}
        <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginTop:'24px',marginBottom:'12px'}}>RECENT ENTRIES</h2>
        {entries.length === 0 && <p style={{color:mg,fontSize:'13px'}}>No entries yet.</p>}
        {entries.slice(0, 7).map(e => (
          <div key={e.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:g}}>{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
            </div>
            <div style={{display:'flex',gap:'12px',fontSize:'12px',color:dg,flexWrap:'wrap'}}>
              {e.mood !== null && <span>Mood {e.mood}</span>}
              {e.energy !== null && <span>· Energy {e.energy}</span>}
              {e.sleep !== null && <span>· Sleep {e.sleep}h</span>}
              {(e as any).weight && <span>· {(e as any).weight}lbs</span>}
              {(e as any).hunger !== null && (e as any).hunger !== undefined && <span>· Hunger {(e as any).hunger}</span>}
            </div>
            {e.notes && <p style={{fontSize:'12px',color:dg,marginTop:'6px'}}>{e.notes}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}