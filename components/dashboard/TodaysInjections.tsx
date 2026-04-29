'use client'
import { useState } from 'react'
import { isDueToday } from '../../lib/utils'

type DueCompound = {
  id: string
  name: string
  dose: string
  dose_unit: string
  time_of_day: string
  protocol_name: string
  start_date?: string
  frequency?: string
  day_of_week?: number | null
}

type LogEntry = {
  compound_id: string
  taken: boolean
  discomfort: number
}

type Props = {
  dueCompounds: DueCompound[]
  tomorrowCompounds: DueCompound[]
  logs: Record<string, LogEntry>
  onToggle: (id: string) => void
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

export default function TodaysInjections({ dueCompounds, tomorrowCompounds, logs, onToggle }: Props) {
  const [open, setOpen] = useState(true)
  const [viewing, setViewing] = useState<'today' | 'tomorrow'>('today')

  const compounds = viewing === 'today' ? dueCompounds : tomorrowCompounds
  if (dueCompounds.length === 0 && tomorrowCompounds.length === 0) return null

  const done = dueCompounds.filter(c => logs[c.id]?.taken).length
  const allDone = done === dueCompounds.length && dueCompounds.length > 0
  const sorted = [...compounds].sort((a, b) => (TIME_ORDER[a.time_of_day] || 0) - (TIME_ORDER[b.time_of_day] || 0))

  return (
    <div style={{background:'var(--color-card)',border:'1px solid '+(allDone&&viewing==='today'?'var(--color-green-30)':'var(--color-border)'),borderRadius:'12px',marginBottom:'16px',overflow:'hidden',transition:'border-color 0.3s'}}>

      {/* Header row */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px'}}>
        <button onClick={() => setOpen(!open)} style={{background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>
          <span style={{fontSize:'13px',fontWeight:'800',color:'var(--color-text)',letterSpacing:'0.5px'}}>
            {viewing === 'today' ? "TODAY'S INJECTIONS" : "TOMORROW'S INJECTIONS"}
          </span>
        </button>
        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
          {viewing === 'today' && (
            <span style={{fontSize:'13px',fontWeight:'700',color:allDone?'var(--color-green)':'var(--color-dim)'}}>{done}/{dueCompounds.length}</span>
          )}
          {viewing === 'tomorrow' && (
            <span style={{fontSize:'13px',fontWeight:'700',color:'var(--color-dim)'}}>{tomorrowCompounds.length} due</span>
          )}
          {/* Today / Tomorrow toggle */}
          <div style={{display:'flex',background:'var(--color-surface)',borderRadius:'8px',padding:'2px',gap:'2px'}}>
            <button onClick={() => setViewing('today')} style={{padding:'4px 10px',borderRadius:'6px',fontSize:'11px',fontWeight:'700',cursor:'pointer',border:'none',background:viewing==='today'?'var(--color-card)':'transparent',color:viewing==='today'?'var(--color-green)':'var(--color-muted)'}}>Today</button>
            <button onClick={() => setViewing('tomorrow')} style={{padding:'4px 10px',borderRadius:'6px',fontSize:'11px',fontWeight:'700',cursor:'pointer',border:'none',background:viewing==='tomorrow'?'var(--color-card)':'transparent',color:viewing==='tomorrow'?'var(--color-green)':'var(--color-muted)'}}>Tomorrow</button>
          </div>
          <button onClick={() => setOpen(!open)} style={{background:'none',border:'none',cursor:'pointer',padding:0}}>
            <span style={{fontSize:'11px',color:'var(--color-muted)',fontWeight:'600'}}>{open ? 'hide' : 'show'}</span>
          </button>
        </div>
      </div>

      {open && (
        <div style={{padding:'0 16px 16px'}}>
          {sorted.length === 0 && (
            <div style={{textAlign:'center',padding:'16px 0',fontSize:'13px',color:'var(--color-dim)'}}>
              {viewing === 'tomorrow' ? 'Rest day tomorrow.' : 'Nothing due today.'}
            </div>
          )}
          {sorted.map(c => {
            const taken = viewing === 'today' ? (logs[c.id]?.taken || false) : false
            const timeLabel = TIME_ICONS[c.time_of_day] || 'AM'
            return (
              <div key={c.id} style={{borderRadius:'10px',padding:'12px 14px',marginBottom:'8px',border:'1px solid '+(taken?'var(--color-green-30)':viewing==='today'?'rgba(200,70,70,0.25)':'var(--color-border)'),background:taken?'var(--color-green-05)':viewing==='today'?'rgba(160,40,40,0.06)':'var(--color-surface)',transition:'all 0.2s ease'}}>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  {viewing === 'today' && (
                    <button onClick={() => onToggle(c.id)} style={{width:'28px',height:'28px',borderRadius:'7px',flexShrink:0,border:'1.5px solid '+(taken?'var(--color-green)':'rgba(200,80,80,0.5)'),background:taken?'var(--color-green)':'transparent',cursor:'pointer',color:'var(--color-green-text)',fontWeight:'800',padding:0,fontSize:'14px'}}>
                      {taken ? '✓' : ''}
                    </button>
                  )}
                  {viewing === 'tomorrow' && (
                    <div style={{width:'28px',height:'28px',borderRadius:'7px',flexShrink:0,border:'1px solid var(--color-border)',background:'var(--color-surface)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:'12px'}}>&#128337;</span>
                    </div>
                  )}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'2px'}}>
                      <span style={{fontSize:'14px',fontWeight:'700',color:taken?'var(--color-muted)':'var(--color-text)',textDecoration:taken?'line-through':'none'}}>{c.name}</span>
                      <span style={{fontSize:'10px',fontWeight:'800',color:'var(--color-text)',background:'var(--color-border)',padding:'3px 7px',borderRadius:'4px'}}>{timeLabel}</span>
                    </div>
                    <span style={{fontSize:'12px',color:'var(--color-text)',fontWeight:'600'}}>{c.dose}{c.dose_unit}</span>
                  </div>
                </div>
              </div>
            )
          })}
          {allDone && viewing === 'today' && (
            <div style={{textAlign:'center',padding:'8px 0 2px',fontSize:'13px',color:'var(--color-green)',fontWeight:'700'}}>
              All injections logged ✓
            </div>
          )}
        </div>
      )}
    </div>
  )
}
