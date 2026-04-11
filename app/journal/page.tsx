'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type JournalEntry = {
  id: string
  date: string
  mood: number
  energy: number
  sleep: number
  notes: string
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [sleep, setSleep] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { loadEntries() }, [])

  async function loadEntries() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .order('date', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  async function saveEntry() {
    setError('')
    if (!sleep || isNaN(parseFloat(sleep))) {
      setError('Please enter how many hours you slept.')
      return
    }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('You must be signed in.'); setSaving(false); return }
    const today = new Date().toISOString().split('T')[0]
    const { error: insertError } = await supabase
      .from('journal_entries')
      .insert({
        user_id: user.id,
        date: today,
        mood,
        energy,
        sleep: parseFloat(sleep),
        notes: notes.trim(),
      })
    if (insertError) { setError(insertError.message); setSaving(false); return }
    setMood(3)
    setEnergy(3)
    setSleep('')
    setNotes('')
    setShowForm(false)
    setSaving(false)
    loadEntries()
  }

  async function deleteEntry(id: string) {
    const supabase = createClient()
    await supabase.from('journal_entries').delete().eq('id', id)
    loadEntries()
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  function moodLabel(val: number) {
    const labels: Record<number, string> = { 1: 'Rough', 2: 'Low', 3: 'Okay', 4: 'Good', 5: 'Great' }
    return labels[val] || val.toString()
  }

  function ScoreButton({ value, current, onChange }: { value: number, current: number, onChange: (v: number) => void }) {
    const isActive = value === current
    return (
      <button
        onClick={() => onChange(value)}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: isActive ? 'none' : '1px solid #374151',
          background: isActive ? '#2563eb' : '#1f2937',
          color: isActive ? 'white' : '#6b7280',
          fontSize: '14px',
          fontWeight: isActive ? '600' : '400',
          cursor: 'pointer',
        }}
      >
        {value}
      </button>
    )
  }

  return (
    <main style={{minHeight:'100vh',background:'#030712',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold'}}>Journal</h1>
          {!showForm && (
            <button onClick={() => setShowForm(true)} style={{background:'#2563eb',color:'white',border:'none',borderRadius:'6px',padding:'8px 16px',fontSize:'14px',fontWeight:'600',cursor:'pointer'}}>
              + Log today
            </button>
          )}
        </div>

        {showForm && (
          <div style={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',padding:'20px',marginBottom:'24px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'16px'}}>How are you today?</h2>

            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:'#9ca3af',marginBottom:'8px'}}>Mood — {moodLabel(mood)}</label>
              <div style={{display:'flex',gap:'8px'}}>
                {[1,2,3,4,5].map(v => <ScoreButton key={v} value={v} current={mood} onChange={setMood} />)}
              </div>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:'#9ca3af',marginBottom:'8px'}}>Energy — {moodLabel(energy)}</label>
              <div style={{display:'flex',gap:'8px'}}>
                {[1,2,3,4,5].map(v => <ScoreButton key={v} value={v} current={energy} onChange={setEnergy} />)}
              </div>
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:'#9ca3af',marginBottom:'4px'}}>Hours of sleep</label>
              <input
                type='number'
                min='0'
                max='24'
                step='0.5'
                value={sleep}
                onChange={e => setSleep(e.target.value)}
                placeholder='e.g. 7.5'
                style={{width:'100%',background:'#1f2937',border:'1px solid #374151',borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box'}}
              />
            </div>

            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:'#9ca3af',marginBottom:'4px'}}>Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder='How do you feel? Any side effects, observations...'
                rows={3}
                style={{width:'100%',background:'#1f2937',border:'1px solid #374151',borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box',resize:'none'}}
              />
            </div>

            {error && (
              <div style={{background:'#450a0a',border:'1px solid #991b1b',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#fca5a5',marginBottom:'12px'}}>{error}</div>
            )}

            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => { setShowForm(false); setError('') }} style={{flex:1,background:'#1f2937',color:'#9ca3af',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={saveEntry} disabled={saving} style={{flex:2,background:saving?'#1d4ed8':'#2563eb',color:'white',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'600',cursor:saving?'not-allowed':'pointer'}}>
                {saving ? 'Saving...' : 'Save Entry'}
              </button>
            </div>
          </div>
        )}

        {loading && <p style={{color:'#6b7280',fontSize:'14px'}}>Loading...</p>}

        {!loading && entries.length === 0 && !showForm && (
          <div style={{textAlign:'center',padding:'48px 0'}}>
            <p style={{color:'#6b7280',marginBottom:'8px'}}>No entries yet.</p>
            <p style={{color:'#4b5563',fontSize:'13px'}}>Tap + Log today to record your first entry.</p>
          </div>
        )}

        {entries.map((entry) => (
          <div key={entry.id} style={{background:'#111827',border:'1px solid #1f2937',borderRadius:'8px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
              <span style={{fontSize:'14px',fontWeight:'600'}}>{formatDate(entry.date)}</span>
              <button onClick={() => deleteEntry(entry.id)} style={{background:'none',border:'none',color:'#4b5563',cursor:'pointer',fontSize:'12px'}}>Delete</button>
            </div>
            <div style={{display:'flex',gap:'16px',marginBottom:'8px'}}>
              <div>
                <span style={{fontSize:'11px',color:'#6b7280',display:'block'}}>MOOD</span>
                <span style={{fontSize:'14px',fontWeight:'500'}}>{moodLabel(entry.mood)}</span>
              </div>
              <div>
                <span style={{fontSize:'11px',color:'#6b7280',display:'block'}}>ENERGY</span>
                <span style={{fontSize:'14px',fontWeight:'500'}}>{moodLabel(entry.energy)}</span>
              </div>
              <div>
                <span style={{fontSize:'11px',color:'#6b7280',display:'block'}}>SLEEP</span>
                <span style={{fontSize:'14px',fontWeight:'500'}}>{entry.sleep}h</span>
              </div>
            </div>
            {entry.notes && <p style={{fontSize:'13px',color:'#9ca3af',marginTop:'8px',lineHeight:'1.5'}}>{entry.notes}</p>}
          </div>
        ))}
      </div>
    </main>
  )
}