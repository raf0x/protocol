'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

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
  const [currentWeek, setCurrentWeek] = useState(0)
  const [showChart, setShowChart] = useState(false)

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
    if (protocols && protocols.length > 0) {
      const earliestStart = protocols.reduce((min: string, p: any) => p.start_date < min ? p.start_date : min, protocols[0].start_date)
      const startMs = new Date(earliestStart + 'T00:00:00').getTime()
      const daysIn = Math.floor((Date.now() - startMs) / 86400000)
      setCurrentWeek(Math.max(1, Math.floor(daysIn / 7) + 1))
    }
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

  const weightEntries = entries.filter((e: any) => e.weight).sort((a, b) => a.date.localeCompare(b.date))
  const startWeight = weightEntries[0]?.weight
  const latestWeight = weightEntries[weightEntries.length - 1]?.weight
  const totalLost = (startWeight && latestWeight) ? (startWeight - latestWeight).toFixed(1) : null
  const chartData = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e: any) => ({
    date: new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    mood: e.mood, energy: e.energy, sleep: e.sleep, weight: e.weight
  }))
  const tooltipStyle = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }

  // Generate insights from user data
  const insights: { text: string; accent: string }[] = []
  if (weightEntries.length >= 2) {
    const first = weightEntries[0]
    const latest = weightEntries[weightEntries.length - 1]
    const diff = first.weight! - latest.weight!
    const daysBetween = Math.max(1, Math.floor((new Date(latest.date).getTime() - new Date(first.date).getTime()) / 86400000))
    const weeksBetween = Math.max(1, daysBetween / 7)
    if (diff > 0) {
      insights.push({ text: `Down ${diff.toFixed(1)} lbs since you started tracking`, accent: g })
      if (weeksBetween >= 2) insights.push({ text: `Averaging ${(diff / weeksBetween).toFixed(1)} lbs lost per week`, accent: g })
    } else if (diff < 0) {
      insights.push({ text: `Up ${Math.abs(diff).toFixed(1)} lbs since you started`, accent: '#f59e0b' })
    }
  }
  if (entries.length >= 5) {
    const moodEntries = entries.filter((e: any) => e.mood !== null)
    if (moodEntries.length >= 3) {
      const avgMood = moodEntries.reduce((s: number, e: any) => s + e.mood, 0) / moodEntries.length
      insights.push({ text: `Your average mood is ${avgMood.toFixed(1)}/5`, accent: g })
    }
    const recentWeek = entries.slice(0, 7).filter((e: any) => e.sleep !== null)
    if (recentWeek.length >= 3) {
      const avgSleep = recentWeek.reduce((s: number, e: any) => s + e.sleep, 0) / recentWeek.length
      insights.push({ text: `Averaging ${avgSleep.toFixed(1)} hours of sleep this week`, accent: '#06b6d4' })
    }
  }
  const hungerEntries = entries.filter((e: any) => e.hunger !== null && e.hunger !== undefined)
  if (hungerEntries.length >= 3) {
    const avgHunger = hungerEntries.reduce((s: number, e: any) => s + e.hunger, 0) / hungerEntries.length
    if (avgHunger <= 2.5) insights.push({ text: `Hunger averaging ${avgHunger.toFixed(1)}/5 — appetite suppression working`, accent: '#8b5cf6' })
    else if (avgHunger >= 4) insights.push({ text: `Hunger trending high (${avgHunger.toFixed(1)}/5) — worth noting`, accent: '#f59e0b' })
  }
  if (currentWeek > 0) {
    insights.push({ text: `${currentWeek} week${currentWeek > 1 ? 's' : ''} into your cycle`, accent: '#6c63ff' })
  }
  // Pick up to 3
  const visibleInsights = insights.slice(0, 3)


  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:g,marginBottom:'8px'}}>Journal</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>Log your day. Track your progress.</p>

        {/* Stats header */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{latestWeight ? latestWeight : '—'}{latestWeight ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT WEIGHT</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:totalLost !== null ? (parseFloat(totalLost) > 0 ? g : parseFloat(totalLost) < 0 ? '#ff6b6b' : g) : g}}>{totalLost !== null ? (parseFloat(totalLost) > 0 ? '-' + Math.abs(parseFloat(totalLost)) : parseFloat(totalLost) < 0 ? '+' + Math.abs(parseFloat(totalLost)) : '0') : '—'}{totalLost !== null ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>WEIGHT CHANGE</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#6c63ff'}}>{currentWeek > 0 ? 'Wk ' + currentWeek : '—'}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT WEEK</div>
          </div>
        </div>


        {/* Insights */}
        {visibleInsights.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>
            {visibleInsights.map((ins, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'white'}}>
                <span style={{color:ins.accent,fontWeight:'700'}}>→</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chart toggle */}
        {entries.length > 1 && (
          <div style={{marginBottom:'16px'}}>
            <button onClick={() => setShowChart(!showChart)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>
              {showChart ? 'Hide chart' : 'Show chart'}
            </button>
          </div>
        )}

        {showChart && chartData.length > 1 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>MOOD, ENERGY & SLEEP</p>
            <ResponsiveContainer width='100%' height={140}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />
                <Line type='monotone' dataKey='energy' stroke='#f97316' strokeWidth={2} dot={false} name='Energy' />
                <Line type='monotone' dataKey='sleep' stroke='#06b6d4' strokeWidth={2} dot={false} name='Sleep (hrs)' />
              </LineChart>
            </ResponsiveContainer>
            {weightEntries.length > 1 && (<>
              <p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT</p>
              <ResponsiveContainer width='100%' height={100}>
                <LineChart data={chartData.filter(d => d.weight)}>
                  <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                  <YAxis tick={{fontSize:10,fill:mg}} width={30} domain={['auto','auto']} />
                  <Tooltip {...tooltipStyle} />
                  <Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name='Weight' />
                </LineChart>
              </ResponsiveContainer>
            </>)}
          </div>
        )}

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