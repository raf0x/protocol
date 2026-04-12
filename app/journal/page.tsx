'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

type JournalEntry = { id: string; date: string; mood: number; energy: number; sleep: number; notes: string }

function ProgressRing({ value, max, color, label, size = 70 }: { value: number; max: number; color: string; label: string; size?: number }) {
  const radius = (size - 10) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(value / max, 1)
  const strokeDashoffset = circumference * (1 - progress)
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px'}}>
      <svg width={size} height={size} style={{transform:'rotate(-90deg)'}}>
        <circle cx={size/2} cy={size/2} r={radius} fill='none' stroke='#1a1a1a' strokeWidth={6} />
        <circle cx={size/2} cy={size/2} r={radius} fill='none' stroke={color} strokeWidth={6} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap='round' style={{transition:'stroke-dashoffset 0.5s ease'}} />
        <text x={size/2} y={size/2} textAnchor='middle' dominantBaseline='middle' fill='white' fontSize={size*0.22} fontWeight='700' style={{transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px`}}>{value > 0 ? value.toFixed(1) : '—'}</text>
      </svg>
      <span style={{fontSize:'10px',color:'#4dbd4d',textAlign:'center'}}>{label}</span>
    </div>
  )
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [sleep, setSleep] = useState('')
  const [notes, setNotes] = useState('')
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showChart, setShowChart] = useState(false)
  const [chartRange, setChartRange] = useState<7|30|'all'>(7)
  const g = '#39ff14'
  const dg = '#4dbd4d'
  const mg = '#2d5a2d'
  const cb = '#0d0d0d'
  const bd = '#1a1a1a'

  useEffect(() => { loadEntries() }, [])

  async function loadEntries() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }

  function startNew() { setEditingId(null); setMood(3); setEnergy(3); setSleep(''); setNotes(''); setEntryDate(new Date().toISOString().split('T')[0]); setShowForm(true); setError('') }
  function startEdit(entry: JournalEntry) { setEditingId(entry.id); setMood(entry.mood); setEnergy(entry.energy); setSleep(String(entry.sleep)); setNotes(entry.notes || ''); setEntryDate(entry.date); setShowForm(true); setError('') }

  async function saveEntry() {
    setError('')
    if (!sleep || isNaN(parseFloat(sleep))) { setError('Please enter how many hours you slept.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSaving(false); return }
    if (editingId) {
      await supabase.from('journal_entries').update({ mood, energy, sleep: parseFloat(sleep), notes: notes.trim(), date: entryDate }).eq('id', editingId)
    } else {
      await supabase.from('journal_entries').insert({ user_id: user.id, date: entryDate, mood, energy, sleep: parseFloat(sleep), notes: notes.trim() })
    }
    setShowForm(false); setEditingId(null); setSaving(false)
    loadEntries()
  }

  async function deleteEntry(id: string) {
    const supabase = createClient()
    await supabase.from('journal_entries').delete().eq('id', id)
    loadEntries()
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  function moodLabel(val: number) {
    return ({1:'Rough',2:'Low',3:'Okay',4:'Good',5:'Great'} as Record<number,string>)[val] || val.toString()
  }

  // --- STATS ---
  function getStreak() {
    if (entries.length === 0) return 0
    const dates = new Set(entries.map(e => e.date))
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const dateStr = d.toISOString().split('T')[0]
      if (dates.has(dateStr)) { streak++ } else { break }
    }
    return streak
  }

  function getWeekAvg(weeksAgo = 0) {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - (7 * weeksAgo) - 6)
    const end = new Date(now)
    end.setDate(end.getDate() - (7 * weeksAgo))
    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]
    const weekEntries = entries.filter(e => e.date >= startStr && e.date <= endStr)
    if (weekEntries.length === 0) return null
    return {
      mood: weekEntries.reduce((s, e) => s + e.mood, 0) / weekEntries.length,
      energy: weekEntries.reduce((s, e) => s + e.energy, 0) / weekEntries.length,
      sleep: weekEntries.reduce((s, e) => s + e.sleep, 0) / weekEntries.length,
      days: weekEntries.length,
    }
  }

  function getDaysLoggedThisWeek() {
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    const startStr = start.toISOString().split('T')[0]
    const endStr = now.toISOString().split('T')[0]
    return entries.filter(e => e.date >= startStr && e.date <= endStr).length
  }

  function getChartData() {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
    if (chartRange === 'all') return sorted.map(e => ({ date: formatDate(e.date), mood: e.mood, energy: e.energy, sleep: e.sleep }))
    const now = new Date()
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - (chartRange - 1))
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return sorted.filter(e => e.date >= cutoffStr).map(e => ({ date: formatDate(e.date), mood: e.mood, energy: e.energy, sleep: e.sleep }))
  }

  const streak = getStreak()
  const thisWeek = getWeekAvg(0)
  const lastWeek = getWeekAvg(1)
  const daysThisWeek = getDaysLoggedThisWeek()
  const chartData = getChartData()
  const sortedEntries = [...entries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  const tooltipStyle = {contentStyle:{background:cb,border:'1px solid '+bd,borderRadius:'6px',fontSize:'12px'}}

  function Delta({ current, previous, label }: { current: number; previous: number; label: string }) {
    const diff = current - previous
    const color = diff > 0 ? g : diff < 0 ? '#ff4444' : dg
    const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
        <span style={{fontSize:'11px',color:mg}}>{label}</span>
        <span style={{fontSize:'16px',fontWeight:'700',color:'white'}}>{current.toFixed(1)}</span>
        <span style={{fontSize:'11px',color,fontWeight:'600'}}>{arrow} {Math.abs(diff).toFixed(1)}</span>
      </div>
    )
  }

  function ScoreButton({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) {
    const isActive = value === current
    return (
      <button onClick={() => onChange(value)} style={{width:'38px',height:'38px',borderRadius:'50%',border:isActive?'none':'1px solid '+bd,background:isActive?g:cb,color:isActive?'#000000':dg,fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>
        {value}
      </button>
    )
  }

  if (loading) return <main style={{minHeight:'100vh',background:'#000000',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',background:'#000000',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>

        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:g}}>Journal</h1>
          <div style={{display:'flex',gap:'8px'}}>
            {entries.length > 1 && <button onClick={() => setShowChart(!showChart)} style={{background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'8px 12px',fontSize:'13px',cursor:'pointer'}}>{showChart?'Hide chart':'Show chart'}</button>}
            {!showForm && <button onClick={startNew} style={{background:g,color:'#000000',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>+ Log today</button>}
          </div>
        </div>

        {entries.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-around',alignItems:'center',marginBottom:'16px'}}>
              <ProgressRing value={daysThisWeek} max={7} color={g} label='Days/week' />
              <ProgressRing value={thisWeek?.mood || 0} max={5} color='#3b82f6' label='Avg mood' />
              <ProgressRing value={thisWeek?.energy || 0} max={5} color='#f59e0b' label='Avg energy' />
              <ProgressRing value={thisWeek?.sleep || 0} max={9} color='#8b5cf6' label='Avg sleep' />
            </div>
            <div style={{borderTop:'1px solid '+bd,paddingTop:'12px',display:'flex',justifyContent:'center',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'20px'}}>{streak >= 3 ? '🔥' : '📅'}</span>
              <span style={{fontSize:'14px',fontWeight:'700',color:streak >= 3 ? g : dg}}>{streak} day streak</span>
              {streak >= 7 && <span style={{fontSize:'11px',color:mg,background:'#0a1a0a',padding:'2px 8px',borderRadius:'4px'}}>WEEKLY GOAL HIT</span>}
            </div>
          </div>
        )}

        {thisWeek && lastWeek && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
            <p style={{fontSize:'12px',color:mg,marginBottom:'12px',textAlign:'center'}}>THIS WEEK VS LAST WEEK</p>
            <div style={{display:'flex',justifyContent:'space-around'}}>
              <Delta current={thisWeek.mood} previous={lastWeek.mood} label='Mood' />
              <Delta current={thisWeek.energy} previous={lastWeek.energy} label='Energy' />
              <Delta current={thisWeek.sleep} previous={lastWeek.sleep} label='Sleep' />
            </div>
          </div>
        )}

        {showChart && chartData.length > 1 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
              <h2 style={{fontSize:'14px',fontWeight:'600',color:g}}>Trends</h2>
              <div style={{display:'flex',gap:'4px'}}>
                {([7,30,'all'] as const).map(r => (
                  <button key={r} onClick={() => setChartRange(r)} style={{background:chartRange===r?'#0a1a0a':'none',border:'1px solid '+(chartRange===r?mg:bd),color:chartRange===r?dg:mg,fontSize:'11px',padding:'3px 8px',borderRadius:'4px',cursor:'pointer'}}>{r === 'all' ? 'All' : r+'d'}</button>
                ))}
              </div>
            </div>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px'}}>Mood & Energy (1-5)</p>
            <ResponsiveContainer width='100%' height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis domain={[1,5]} tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />
                <Line type='monotone' dataKey='energy' stroke={dg} strokeWidth={2} dot={false} name='Energy' />
              </LineChart>
            </ResponsiveContainer>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px'}}>Sleep (hours)</p>
            <ResponsiveContainer width='100%' height={100}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='sleep' stroke='#7fff7f' strokeWidth={2} dot={false} name='Sleep' />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {showForm && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'20px',marginBottom:'24px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'16px',color:g}}>{editingId ? 'Edit Entry' : 'How are you today?'}</h2>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px'}}>Date</label>
              <input type='date' value={entryDate} onChange={e => setEntryDate(e.target.value)} style={{width:'100%',background:'#000000',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box',colorScheme:'dark',maxWidth:'100%',overflow:'hidden'}} />
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'8px'}}>Mood — {moodLabel(mood)}</label>
              <div style={{display:'flex',gap:'8px'}}>{[1,2,3,4,5].map(v => <ScoreButton key={v} value={v} current={mood} onChange={setMood} />)}</div>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'8px'}}>Energy — {moodLabel(energy)}</label>
              <div style={{display:'flex',gap:'8px'}}>{[1,2,3,4,5].map(v => <ScoreButton key={v} value={v} current={energy} onChange={setEnergy} />)}</div>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px'}}>Hours of sleep</label>
              <input type='number' min='0' max='24' step='0.5' value={sleep} onChange={e => setSleep(e.target.value)} placeholder='e.g. 7.5' style={{width:'100%',background:'#000000',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box'}} />
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px'}}>Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='How do you feel? Any observations...' rows={3} style={{width:'100%',background:'#000000',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box',resize:'none'}} />
            </div>
            {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'12px'}}>{error}</div>}
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => { setShowForm(false); setError(''); setEditingId(null) }} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={saveEntry} disabled={saving} style={{flex:2,background:saving?'#1a3d1a':g,color:saving?mg:'#000000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':editingId?'Save Changes':'Save Entry'}</button>
            </div>
          </div>
        )}

        {!loading && entries.length === 0 && !showForm && (
          <div style={{textAlign:'center',padding:'48px 0'}}>
            <p style={{color:dg,marginBottom:'8px'}}>No entries yet.</p>
            <p style={{color:mg,fontSize:'13px'}}>Tap + Log today to record your first entry.</p>
          </div>
        )}

        {sortedEntries.map((entry) => (
          <div key={entry.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <span style={{fontSize:'14px',fontWeight:'600',color:g}}>{formatDate(entry.date)}</span>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => startEdit(entry)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'12px'}}>Edit</button>
                <button onClick={() => deleteEntry(entry.id)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>Delete</button>
              </div>
            </div>
            <div style={{display:'flex',gap:'16px',marginBottom:'8px'}}>
              <div><span style={{fontSize:'11px',color:mg,display:'block'}}>MOOD</span><span style={{fontSize:'14px',fontWeight:'500'}}>{moodLabel(entry.mood)}</span></div>
              <div><span style={{fontSize:'11px',color:mg,display:'block'}}>ENERGY</span><span style={{fontSize:'14px',fontWeight:'500'}}>{moodLabel(entry.energy)}</span></div>
              <div><span style={{fontSize:'11px',color:mg,display:'block'}}>SLEEP</span><span style={{fontSize:'14px',fontWeight:'500'}}>{entry.sleep}h</span></div>
            </div>
            {entry.notes && <p style={{fontSize:'13px',color:dg,marginTop:'8px',lineHeight:'1.5'}}>{entry.notes}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}