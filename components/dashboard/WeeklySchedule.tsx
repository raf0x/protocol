'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { isDueToday } from '../../lib/utils'

type Compound = { id: string; name: string; protocol_start: string; phases: any[] }
type Props = { activeProtocols: any[] }

function getWeekDates(): Date[] {
  const today = new Date(); today.setHours(0,0,0,0)
  const day = today.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(today); monday.setDate(today.getDate() + diff)
  return Array.from({length:7}, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
}

const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

export default function WeeklySchedule({ activeProtocols }: Props) {
  const [logs, setLogs] = useState<Record<string,boolean>>({})
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const weekDates = getWeekDates()
  const today = new Date(); today.setHours(0,0,0,0)
  const todayStr = today.toISOString().split('T')[0]
  const g = 'var(--color-green)'
  const bd = 'var(--color-border)'
  const cb = 'var(--color-card)'
  const dg = 'var(--color-dim)'

  const compounds: Compound[] = activeProtocols.flatMap(p =>
    (p.compounds || []).map((c: any) => ({ id: c.id, name: c.name, protocol_start: p.start_date, phases: c.phases || [] }))
  )

  useEffect(() => {
    if (compounds.length > 0 && order.length === 0) {
      setOrder(compounds.map(c => c.id))
    }
  }, [compounds.length])

  useEffect(() => {
    async function loadLogs() {
      if (compounds.length === 0) { setLoading(false); return }
      const supabase = createClient()
      const startStr = weekDates[0].toISOString().split('T')[0]
      const endStr = weekDates[6].toISOString().split('T')[0]
      const { data } = await supabase.from('injection_logs').select('compound_id, date, taken').gte('date', startStr).lte('date', endStr).eq('taken', true)
      const map: Record<string,boolean> = {}
      ;(data || []).forEach((l: any) => { map[l.compound_id + '_' + l.date] = true })
      setLogs(map)
      setLoading(false)
    }
    loadLogs()
  }, [activeProtocols.length])

  async function toggleLog(compoundId: string, dateStr: string) {
    const key = compoundId + '_' + dateStr
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (logs[key]) {
      await supabase.from('injection_logs').delete().eq('compound_id', compoundId).eq('date', dateStr).eq('user_id', user.id)
      const u = { ...logs }; delete u[key]; setLogs(u)
    } else {
      await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: compoundId, date: dateStr, taken: true, discomfort: 0 }, { onConflict: 'user_id,compound_id,date' })
      setLogs({ ...logs, [key]: true })
    }
    try { navigator.vibrate(8) } catch(e) {}
  }

  async function saveOrder(newOrder: string[]) {
    const supabase = createClient()
    for (let i = 0; i < newOrder.length; i++) {
      await supabase.from('compounds').update({ position: i }).eq('id', newOrder[i])
    }
  }

  function handleDragStart(id: string) {
    setDraggingId(id)
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (id !== draggingId) setDragOverId(id)
  }

  function handleDrop(id: string) {
    if (!draggingId || draggingId === id) { setDraggingId(null); setDragOverId(null); return }
    const currentOrder = order.length > 0 ? order : compounds.map(c => c.id)
    const from = currentOrder.indexOf(draggingId)
    const to = currentOrder.indexOf(id)
    const newOrder = [...currentOrder]
    newOrder.splice(from, 1)
    newOrder.splice(to, 0, draggingId)
    setOrder(newOrder)
    setDraggingId(null)
    setDragOverId(null)
    saveOrder(newOrder)
  }

  // Touch drag support
  function handleTouchStart(e: React.TouchEvent, id: string) {
    setDraggingId(id)
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const row = el?.closest('[data-compound-id]')
    const overId = row?.getAttribute('data-compound-id')
    if (overId && overId !== draggingId) setDragOverId(overId)
  }

  function handleTouchEnd() {
    if (draggingId && dragOverId) handleDrop(dragOverId)
    setDraggingId(null)
    setDragOverId(null)
  }

  function isDueOnDate(compound: Compound, date: Date): boolean {
    const dateStr = date.toISOString().split('T')[0]
    const daysIn = Math.max(0, Math.floor((date.getTime() - new Date(compound.protocol_start + 'T00:00:00').getTime()) / 86400000))
    const wk = Math.max(1, Math.floor(daysIn/7)+1)
    const phase = compound.phases.find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || compound.phases[0]
    if (!phase) return false
    return isDueToday(phase.frequency, compound.protocol_start, phase.day_of_week, dateStr, phase.days_of_week)
  }

  if (loading || compounds.length === 0) return null
  const sortedCompounds = order.length > 0
    ? [...compounds].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    : compounds

  return (
    <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',marginBottom:'16px',overflow:'hidden'}}>
      <div style={{padding:'12px 16px 8px',fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>MY SCHEDULE</div>
      <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',position:'relative'}}>
        <table style={{width:'100%',borderCollapse:'collapse',minWidth:'340px'}}>
          <thead>
            <tr>
              <th style={{padding:'6px 10px',textAlign:'left',fontSize:'11px',color:dg,fontWeight:'600',minWidth:'80px',borderBottom:'1px solid '+bd}}></th>
              {weekDates.map((date, i) => {
                const isToday = date.toISOString().split('T')[0] === todayStr
                return (
                  <th key={i} style={{padding:'6px 4px',textAlign:'center',fontSize:'10px',fontWeight:'700',borderBottom:'1px solid '+bd,background:isToday?g:'transparent',color:isToday?'var(--color-green-text)':dg,minWidth:'40px'}}>
                    <div>{DAY_LABELS[i]}</div>
                    <div style={{fontSize:'9px',fontWeight:'600',opacity:0.8}}>{date.getMonth()+1}/{date.getDate()}</div>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sortedCompounds.map((compound) => (
              <tr
                key={compound.id}
                data-compound-id={compound.id}
                draggable
                onDragStart={() => handleDragStart(compound.id)}
                onDragOver={e => handleDragOver(e, compound.id)}
                onDrop={() => handleDrop(compound.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                onTouchStart={e => handleTouchStart(e, compound.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  borderTop:'1px solid '+bd,
                  opacity: draggingId === compound.id ? 0.4 : 1,
                  background: dragOverId === compound.id ? 'var(--color-green-05)' : 'transparent',
                  transition:'opacity 0.15s, background 0.15s',
                  cursor:'grab'
                }}
              >
                <td style={{padding:'8px 10px',fontSize:'11px',fontWeight:'700',color:'var(--color-text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'80px'}}>
                  <span style={{marginRight:'4px',opacity:0.3,fontSize:'10px'}}>↕</span>
                  {compound.name.split('/')[0].split(' ')[0]}
                </td>
                {weekDates.map((date, di) => {
                  const dateStr = date.toISOString().split('T')[0]
                  const isToday = dateStr === todayStr
                  const isPast = date.getTime() < today.getTime() && !isToday
                  const isFuture = date.getTime() > today.getTime() && !isToday
                  const isDue = isDueOnDate(compound, date)
                  const isLogged = !!logs[compound.id + '_' + dateStr] && !isFuture
                  const canTap = isDue && !isFuture
                  return (
                    <td key={di} style={{padding:'6px 4px',textAlign:'center',background:isToday?'rgba(57,255,20,0.08)':'transparent',borderLeft:isToday?'1px solid rgba(57,255,20,0.2)':'none',borderRight:isToday?'1px solid rgba(57,255,20,0.2)':'none'}}>
                      {isDue && (
                        <button onClick={() => canTap && toggleLog(compound.id, dateStr)} style={{width:'26px',height:'26px',borderRadius:'50%',border:'none',cursor:canTap?'pointer':'default',display:'inline-flex',alignItems:'center',justifyContent:'center',background:isLogged?g:isPast?'rgba(255,107,107,0.15)':isToday?'rgba(57,255,20,0.15)':'transparent'}}>
                          {isLogged ? <span style={{color:isToday?'var(--color-green-text)':'var(--color-green-text)',fontWeight:'900',fontSize:'13px'}}>✓</span>
                          : isPast ? <span style={{color:'#ff6b6b',fontWeight:'900',fontSize:'18px',lineHeight:1}}>·</span>
                          : isToday ? <span style={{color:g,fontWeight:'900',fontSize:'14px'}}>●</span>
                          : <span style={{color:dg,fontSize:'14px',opacity:0.3}}>●</span>}
                        </button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{padding:'8px 16px',display:'flex',gap:'16px',borderTop:'1px solid '+bd}}>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><span style={{color:'var(--color-green)',fontSize:'12px',fontWeight:'900'}}>✓</span><span style={{fontSize:'10px',color:dg}}>Logged</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><span style={{color:'#ff6b6b',fontSize:'16px',fontWeight:'900',lineHeight:1}}>·</span><span style={{fontSize:'10px',color:dg}}>Missed</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><span style={{color:g,fontSize:'12px',fontWeight:'900'}}>●</span><span style={{fontSize:'10px',color:dg}}>Due today</span></div>
        <div style={{display:'flex',alignItems:'center',gap:'4px'}}><span style={{color:dg,fontSize:'12px',opacity:0.3}}>●</span><span style={{fontSize:'10px',color:dg}}>Scheduled</span></div>
      </div>
    </div>
  )
}