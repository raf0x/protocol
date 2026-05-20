'use client'
import { useState } from 'react'

type Props = {
  mood: number | null
  energy: number | null
  hunger: number | null
  sleep: string
  weight: string
  notes: string
  saving: boolean
  saved: boolean
  onMoodChange: (v: number) => void
  onEnergyChange: (v: number) => void
  onHungerChange: (v: number) => void
  onSleepChange: (v: string) => void
  onWeightChange: (v: string) => void
  onNotesChange: (v: string) => void
  onSave: () => void
}

export default function CompactDailyLog({
  mood, energy, hunger, sleep, weight, notes,
  saving, saved,
  onMoodChange, onEnergyChange, onHungerChange,
  onSleepChange, onWeightChange, onNotesChange, onSave
}: Props) {
  const [openTab, setOpenTab] = useState<string | null>(null)
  
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const mg = 'var(--color-muted)'
  const cb = 'var(--color-card)'
  const bd = 'var(--color-border)'

  const tabs = [
    { id: 'mood', label: 'Mood', value: mood, onChange: onMoodChange, reverse: false },
    { id: 'energy', label: 'Energy', value: energy, onChange: onEnergyChange, reverse: false },
    { id: 'hunger', label: 'Hunger', value: hunger, onChange: onHungerChange, reverse: true },
  ]

  function ScoreBtn({ value, current, onChange, reverse }: { value: number; current: number | null; onChange: (v: number) => void; reverse?: boolean }) {
    const a = current === value
    const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']
    const reverseColors = ['#22c55e','#84cc16','#eab308','#f97316','#ef4444']
    const sc = (reverse ? reverseColors : scoreColors)[value-1]
    return (
      <button
        onClick={() => { onChange(value); setOpenTab(null) }}
        style={{
          width:'36px',
          height:'36px',
          borderRadius:'50%',
          border:a?'none':'1px solid '+bd,
          background:a?sc:cb,
          color:a?'#fff':dg,
          fontSize:'13px',
          fontWeight:'700',
          cursor:'pointer',
          opacity:a?1:0.5
        }}
      >
        {value}
      </button>
    )
  }

  const getStatusColor = (val: number | null) => {
    if (val === null) return mg
    if (val >= 4) return '#22c55e'
    if (val >= 3) return '#eab308'
    return '#ef4444'
  }

  return (
    <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'12px',marginBottom:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
        <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>DAILY LOG</span>
        {saved && <span style={{fontSize:'11px',color:g}}>✓ saved</span>}
      </div>

      {/* Collapsible tabs */}
      <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'10px'}}>
        {tabs.map(tab => (
          <div key={tab.id} style={{border:'1px solid '+bd,borderRadius:'8px',overflow:'hidden'}}>
            <button
              onClick={() => setOpenTab(openTab === tab.id ? null : tab.id)}
              style={{
                width:'100%',
                background:'var(--color-surface)',
                border:'none',
                padding:'10px 12px',
                display:'flex',
                justifyContent:'space-between',
                alignItems:'center',
                cursor:'pointer'
              }}
            >
              <span style={{fontSize:'12px',fontWeight:'600',color:'var(--color-text)'}}>{tab.label}</span>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                {tab.value !== null && (
                  <span style={{
                    fontSize:'12px',
                    fontWeight:'700',
                    color:getStatusColor(tab.value),
                    background:getStatusColor(tab.value)+'22',
                    padding:'2px 8px',
                    borderRadius:'12px'
                  }}>
                    {tab.value}/5
                  </span>
                )}
                <span style={{fontSize:'10px',color:dg}}>{openTab === tab.id ? '▼' : '▶'}</span>
              </div>
            </button>
            {openTab === tab.id && (
              <div style={{padding:'12px',background:cb,display:'flex',gap:'6px',justifyContent:'center'}}>
                {[1,2,3,4,5].map(v => (
                  <ScoreBtn key={v} value={v} current={tab.value} onChange={tab.onChange} reverse={tab.reverse} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sleep & Weight inline */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'10px'}}>
        <div>
          <span style={{fontSize:'10px',color:mg,display:'block',marginBottom:'4px',fontWeight:'600',letterSpacing:'0.5px'}}>SLEEP (hrs)</span>
          <input
            type='number'
            step='0.5'
            value={sleep}
            onChange={e => onSleepChange(e.target.value)}
            placeholder='7.5'
            style={{
              width:'100%',
              background:'var(--color-surface)',
              border:'1px solid '+bd,
              borderRadius:'6px',
              padding:'8px',
              color:'var(--color-text)',
              fontSize:'13px',
              boxSizing:'border-box'
            }}
          />
        </div>
        <div>
          <span style={{fontSize:'10px',color:mg,display:'block',marginBottom:'4px',fontWeight:'600',letterSpacing:'0.5px'}}>WEIGHT (lbs)</span>
          <input
            type='number'
            step='0.1'
            value={weight}
            onChange={e => onWeightChange(e.target.value)}
            placeholder='optional'
            style={{
              width:'100%',
              background:'var(--color-surface)',
              border:'1px solid '+bd,
              borderRadius:'6px',
              padding:'8px',
              color:'var(--color-text)',
              fontSize:'13px',
              boxSizing:'border-box'
            }}
          />
        </div>
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={e => onNotesChange(e.target.value)}
        placeholder='Notes...'
        rows={2}
        style={{
          width:'100%',
          background:'var(--color-surface)',
          border:'1px solid '+bd,
          borderRadius:'6px',
          padding:'8px',
          color:'var(--color-text)',
          fontSize:'12px',
          boxSizing:'border-box',
          resize:'none',
          marginBottom:'10px'
        }}
      />

      {/* Save button */}
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          width:'100%',
          background:saving?'var(--color-green-20)':g,
          color:saving?'var(--color-muted)':'var(--color-green-text)',
          border:'none',
          borderRadius:'6px',
          padding:'10px',
          fontSize:'13px',
          fontWeight:'700',
          cursor:'pointer'
        }}
      >
        {saving?'Saving...':saved?'Update':'Save'}
      </button>
    </div>
  )
}
