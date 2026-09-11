const fs = require('fs');

const content = `'use client'
import { useState } from 'react'

type DueCompound = {
  id: string
  name: string
  dose: string
  dose_unit: string
  volume_ml: number
  syringe_units: number
  time_of_day: string
  protocol_name: string
}

type LogEntry = {
  compound_id: string
  taken: boolean
  discomfort: number
}

type Props = {
  dueCompounds: DueCompound[]
  logs: Record<string, LogEntry>
  onToggle: (id: string) => void
  onDiscomfort: (id: string, v: number) => void
}

const TIME_ICONS: Record<string, string> = {
  morning: 'AM',
  afternoon: 'PM',
  evening: 'EVE',
  night: 'NIGHT',
}

const TIME_ORDER: Record<string, number> = {
  morning: 0, afternoon: 1, evening: 2, night: 3,
}

function DiscomfortBtn({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) {
  const a = current === value
  const c = value === 0 ? 'var(--color-green)' : '#ff6b6b'
  return (
    <button onClick={() => onChange(value)} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid '+(a?c:'var(--color-border)'),background:a?(value===0?'var(--color-green-15)':'rgba(255,107,107,0.15)'):'transparent',color:a?c:'var(--color-dim)',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>
      {value}
    </button>
  )
}

export default function TodaysInjections({ dueCompounds, logs, onToggle, onDiscomfort }: Props) {
  const [open, setOpen] = useState(true)

  if (dueCompounds.length === 0) return null

  const done = dueCompounds.filter(c => logs[c.id]?.taken).length
  const allDone = done === dueCompounds.length
  const sorted = [...dueCompounds].sort((a, b) => (TIME_ORDER[a.time_of_day] || 0) - (TIME_ORDER[b.time_of_day] || 0))

  return (
    <div style={{background:'var(--color-card)',border:'1px solid '+(allDone?'var(--color-green-30)':'var(--color-border)'),borderRadius:'12px',marginBottom:'16px',overflow:'hidden',transition:'border-color 0.3s'}}>
      <button onClick={() => setOpen(!open)} style={{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px',background:'none',border:'none',cursor:'pointer'}}>
        <span style={{fontSize:'13px',fontWeight:'800',color:'var(--color-text)',letterSpacing:'0.5px'}}>TODAY'S INJECTIONS</span>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'13px',fontWeight:'700',color:allDone?'var(--color-green)':'var(--color-dim)'}}>{done}/{dueCompounds.length}</span>
          <span style={{fontSize:'11px',color:'var(--color-muted)',fontWeight:'600'}}>{open ? 'hide' : 'show'}</span>
        </div>
      </button>

      {open && (
        <div style={{padding:'0 16px 16px'}}>
          {sorted.map(c => {
            const log = logs[c.id]
            const taken = log?.taken || false
            const dis = log?.discomfort || 0
            const timeLabel = TIME_ICONS[c.time_of_day] || 'AM'
            return (
              <div key={c.id} style={{borderRadius:'10px',padding:'12px 14px',marginBottom:'8px',border:'1px solid '+(taken?'var(--color-green-30)':'rgba(200,70,70,0.25)'),background:taken?'var(--color-green-05)':'rgba(160,40,40,0.06)',transition:'all 0.2s ease'}}>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <button onClick={() => onToggle(c.id)} style={{width:'28px',height:'28px',borderRadius:'7px',flexShrink:0,border:'1.5px solid '+(taken?'var(--color-green)':'rgba(200,80,80,0.5)'),background:taken?'var(--color-green)':'transparent',cursor:'pointer',color:'var(--color-green-text)',fontWeight:'800',padding:0,fontSize:'14px'}}>
                    {taken ? '\u2713' : ''}
                  </button>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                      <span style={{fontSize:'14px',fontWeight:'700',color:taken?'var(--color-dim)':'var(--color-text)',textDecoration:taken?'line-through':'none'}}>{c.name}</span>
                      <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-dim)',background:'var(--color-surface)',padding:'2px 5px',borderRadius:'4px'}}>{timeLabel}</span>
                    </div>
                    <span style={{fontSize:'12px',color:'var(--color-muted)'}}>
                      {c.dose}{c.dose_unit}
                      {c.syringe_units > 0 ? ' \u00b7 ' + c.syringe_units.toFixed(0) + ' IU' : ''}
                      {c.volume_ml > 0 ? ' \u00b7 ' + c.volume_ml.toFixed(2) + ' mL' : ''}
                    </span>
                  </div>
                </div>
                {taken && (
                  <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)'}}>
                    <span style={{fontSize:'10px',color:'var(--color-muted)',display:'block',marginBottom:'6px',letterSpacing:'1px'}}>DISCOMFORT (0 = none)</span>
                    <div style={{display:'flex',gap:'6px'}}>
                      {[0,1,2,3,4,5].map(n => <DiscomfortBtn key={n} value={n} current={dis} onChange={v => onDiscomfort(c.id, v)} />)}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {allDone && (
            <div style={{textAlign:'center',padding:'8px 0 2px',fontSize:'13px',color:'var(--color-green)',fontWeight:'700'}}>
              All injections logged \u2713
            </div>
          )}
        </div>
      )}
    </div>
  )
}
`;

fs.writeFileSync('components/dashboard/TodaysInjections.tsx', content, 'utf8');
console.log('Done!');
