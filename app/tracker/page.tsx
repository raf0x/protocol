'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

import { ADMIN_USER_ID } from '../../lib/constants'
const ADMIN_ID = ADMIN_USER_ID

// Your protocol data
const retaProtocol = [
  { phase: "1a", weeks: [1, 2], dose: "1mg", units: 20, ml: "0.2ml", dates: "Mar 15 - Mar 22" },
  { phase: "1b", weeks: [3, 4], dose: "2mg", units: 40, ml: "0.4ml", dates: "Mar 29 - Apr 5" },
  { phase: "2", weeks: [5, 6, 7, 8], dose: "3mg", units: 60, ml: "0.6ml", dates: "Apr 12 - May 3" },
  { phase: "3", weeks: [9, 10, 11, 12, 13, 14], dose: "4mg", units: 80, ml: "0.8ml", dates: "May 10 - Jun 14" },
  { phase: "4", weeks: [15, 16, 17, 18, 19, 20, 21, 22], dose: "5mg", units: 100, ml: "1.0ml", dates: "Jun 21 - Aug 9" },
  { phase: "Taper", weeks: [23, 24, 25, 26], dose: "4mg", units: 80, ml: "0.8ml", dates: "Aug 16 - Sep 6" },
  { phase: "Final", weeks: [27], dose: "2mg", units: 40, ml: "0.4ml", dates: "Sep 13" },
]

const CURRENT_WEEK = 6

const defaultCjc = [
  { night: 1, date: "Apr 2", units: 10, done: true },
  { night: 2, date: "Apr 3", units: 10, done: true },
  { night: 3, date: "Apr 4", units: 10, done: true },
  { night: 4, date: "Apr 6", units: 10, done: true },
  { night: 5, date: "Apr 7", units: 13, done: true },
  { night: 6, date: "Apr 8", units: 13, done: true },
  { night: 7, date: "Apr 9", units: 13, done: true },
  { night: 8, date: "Apr 10", units: 13, done: true },
  { night: 9, date: "Apr 13", units: 13, done: false },
  { night: 10, date: "Apr 14", units: 13, done: false },
  { night: 11, date: "Apr 15", units: 13, done: false },
  { night: 12, date: "Apr 16", units: 13, done: false },
  { night: 13, date: "Apr 17", units: 13, done: false },
  { night: 14, date: "Apr 20", units: 13, done: false },
  { night: 15, date: "Apr 21", units: 13, done: false },
  { night: 16, date: "Apr 22", units: 13, done: false },
  { night: 17, date: "Apr 23", units: 13, done: false },
  { night: 18, date: "Apr 24", units: 13, done: false },
  { night: 19, date: "Apr 27", units: 13, done: false },
  { night: 20, date: "Apr 28", units: 13, done: false },
  { night: 21, date: "Apr 29", units: 13, done: false },
  { night: 22, date: "Apr 30", units: 13, done: false },
]

const defaultHcg = [
  { dose: 1, date: "Apr 20", day: "Mon", units: 10, iu: 500, note: "500 IU bridge", done: true },
  { dose: 2, date: "Apr 24", day: "Fri", units: 10, iu: 500, note: "Last 500 IU shot", done: false },
  { dose: 3, date: "Apr 28", day: "Tue", units: 5, iu: 250, note: "Drop to 250 IU 2x/week", done: false },
  { dose: 4, date: "May 1", day: "Fri", units: 5, iu: 250, note: "250 IU maintenance", done: false },
  { dose: 5, date: "May 5", day: "Tue", units: 5, iu: 250, note: "250 IU maintenance", done: false },
  { dose: 6, date: "May 8", day: "Fri", units: 5, iu: 250, note: "250 IU maintenance", done: false },
  { dose: 7, date: "May 12", day: "Tue", units: 5, iu: 250, note: "250 IU maintenance", done: false },
  { dose: 8, date: "May 15", day: "Fri", units: 5, iu: 250, note: "250 IU maintenance", done: false },
  { dose: 9, date: "May 19", day: "Tue", units: 5, iu: 250, note: "250 IU maintenance", done: false },
]

const defaultGhk = [
  { dose: 1, date: "Apr 22", day: "Wed", units: 10, mg: "1.667mg", note: "Start", done: true },
  { dose: 2, date: "Apr 23", day: "Thu", units: 10, mg: "1.667mg", note: "10 units daily", done: false },
  { dose: 3, date: "Apr 24", day: "Fri", units: 10, mg: "1.667mg", note: "10 units daily", done: false },
  { dose: 4, date: "Apr 25", day: "Sat", units: 10, mg: "1.667mg", note: "10 units daily", done: false },
  { dose: 5, date: "Apr 26", day: "Sun", units: 10, mg: "1.667mg", note: "10 units daily", done: false },
  { dose: 6, date: "Apr 27", day: "Mon", units: 10, mg: "1.667mg", note: "10 units daily", done: false },
  { dose: 7, date: "Apr 28", day: "Tue", units: 20, mg: "3.33mg", note: "Increase to 20 units", done: false },
  { dose: 8, date: "Apr 29", day: "Wed", units: 20, mg: "3.33mg", note: "20 units daily", done: false },
  { dose: 9, date: "Apr 30", day: "Thu", units: 20, mg: "3.33mg", note: "Last before Peru", done: false },
  { dose: 10, date: "May 16", day: "Sat", units: 20, mg: "3.33mg", note: "Resume post-Peru", done: false },
  { dose: 11, date: "May 17", day: "Sun", units: 20, mg: "3.33mg", note: "20 units daily", done: false },
  { dose: 12, date: "May 18", day: "Mon", units: 20, mg: "3.33mg", note: "20 units daily", done: false },
  { dose: 13, date: "May 19", day: "Tue", units: 20, mg: "3.33mg", note: "20 units daily", done: false },
  { dose: 14, date: "May 20", day: "Wed", units: 20, mg: "3.33mg", note: "20 units daily", done: false },
]

const defaultWolverine = [
  { shot: 1, date: "Apr 17", units: 100, bpc: "1.67mg", tb: "1.67mg", done: true },
  { shot: 2, date: "Apr 20", units: 50, bpc: "0.83mg", tb: "0.83mg", done: false },
  { shot: 3, date: "Apr 23", units: 50, bpc: "0.83mg", tb: "0.83mg", done: false },
  { shot: 4, date: "Apr 26", units: 50, bpc: "0.83mg", tb: "0.83mg", done: false },
  { shot: 5, date: "Apr 29", units: 50, bpc: "0.83mg", tb: "0.83mg", done: false },
]

const phaseColors: Record<string, string> = {
  "1a": "#3b82f6", "1b": "#2563eb", "2": "#22c55e", "3": "#eab308",
  "4": "#f97316", "Taper": "#8b5cf6", "Final": "#ef4444",
}

export default function TrackerPage() {
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('reta')
  const [weights, setWeights] = useState<Record<number, number>>({ 1: 180.6, 3: 178.8, 4: 176.6, 5: 177 })
  const [editingWeek, setEditingWeek] = useState<number | null>(null)
  const [inputVal, setInputVal] = useState('')
  const [cjcLog, setCjcLog] = useState(defaultCjc)
  const [hcgLog, setHcgLog] = useState(defaultHcg)
  const [ghkLog, setGhkLog] = useState(defaultGhk)
  const [wolverineLog, setWolverineLog] = useState(defaultWolverine)

  const g = '#39ff14', dg = '#8b8ba7', mg = '#3d3d5c', cb = '#12121a', bd = '#1e1e2e'

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id === ADMIN_ID) {
        setAuthorized(true)
        // Load saved state from Supabase user profile or localStorage
        try {
          const saved = localStorage.getItem('raf_tracker')
          if (saved) {
            const d = JSON.parse(saved)
            if (d.weights) setWeights(d.weights)
            if (d.cjc) setCjcLog(d.cjc)
            if (d.hcg) setHcgLog(d.hcg)
            if (d.ghk) setGhkLog(d.ghk)
            if (d.wolverine) setWolverineLog(d.wolverine)
          }
        } catch {}
      }
      setLoading(false)
    }
    check()
  }, [])

  function saveAll(w?: any, c?: any, h?: any, gk?: any, wl?: any) {
    const data = { weights: w || weights, cjc: c || cjcLog, hcg: h || hcgLog, ghk: gk || ghkLog, wolverine: wl || wolverineLog }
    localStorage.setItem('raf_tracker', JSON.stringify(data))
  }

  function handleSaveWeight(weekNum: number) {
    const val = parseFloat(inputVal)
    if (!isNaN(val) && val > 0) {
      const updated = { ...weights, [weekNum]: val }
      setWeights(updated)
      saveAll(updated)
    }
    setEditingWeek(null); setInputVal('')
  }

  function toggleCjc(idx: number) { const u = cjcLog.map((e, i) => i === idx ? { ...e, done: !e.done } : e); setCjcLog(u); saveAll(undefined, u) }
  function toggleHcg(idx: number) { const u = hcgLog.map((e, i) => i === idx ? { ...e, done: !e.done } : e); setHcgLog(u); saveAll(undefined, undefined, u) }
  function toggleGhk(idx: number) { const u = ghkLog.map((e, i) => i === idx ? { ...e, done: !e.done } : e); setGhkLog(u); saveAll(undefined, undefined, undefined, u) }
  function toggleWolverine(idx: number) { const u = wolverineLog.map((e, i) => i === idx ? { ...e, done: !e.done } : e); setWolverineLog(u); saveAll(undefined, undefined, undefined, undefined, u) }

  const allWeeks = Array.from({ length: 27 }, (_, i) => {
    const weekNum = i + 1
    const phase = retaProtocol.find(p => p.weeks.includes(weekNum))
    const injectionDate = new Date(2026, 2, 15 + i * 7)
    const dateStr = injectionDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { weekNum, phase, dateStr }
  })

  const startWeight = weights[1] || 180.6
  const validWeights = Object.fromEntries(Object.entries(weights).filter(([, v]) => v != null))
  const latestWeek = Object.keys(validWeights).map(Number).sort((a, b) => b - a)[0]
  const latestWeight = validWeights[latestWeek] || startWeight
  const totalLost = (startWeight - latestWeight).toFixed(1)

  const tabs = [
    { id: 'reta', label: 'Reta' },
    { id: 'cjc', label: 'CJC/Ipa' },
    { id: 'hcg', label: 'HCG' },
    { id: 'ghk', label: 'GHK-Cu' },
    { id: 'wolverine', label: 'BPC/TB' },
  ]

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>
  if (!authorized) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Not authorized</main>

  return (
    <main style={{minHeight:'100vh',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'540px',margin:'0 auto'}}>
        <a href='/protocol' style={{color:dg,fontSize:'13px',textDecoration:'none'}}>← Dashboard</a>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:g,marginTop:'14px',marginBottom:'4px'}}>My Protocol Tracker</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>Active Stack · April 2026</p>

        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:g}}>{totalLost} lbs</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>TOTAL LOST</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#6c63ff'}}>Wk {CURRENT_WEEK}</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>RETA WEEK</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{latestWeight} lbs</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:'6px',marginBottom:'16px',overflowX:'auto'}}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{padding:'8px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap',border:activeTab===tab.id?'1px solid '+g:'1px solid '+bd,background:activeTab===tab.id?'rgba(57,255,20,0.1)':cb,color:activeTab===tab.id?g:dg}}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* RETA */}
        {activeTab === 'reta' && (
          <>
            <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>RETATRUTIDE PROTOCOL</div>
              <p style={{fontSize:'11px',color:dg,marginBottom:'12px'}}>Sunday injections · Started Mar 15</p>
              {retaProtocol.map(p => (
                <div key={p.phase} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid '+bd}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{fontSize:'10px',fontWeight:'700',padding:'2px 8px',borderRadius:'4px',background:phaseColors[p.phase]||mg,color:'#000'}}>P{p.phase}</span>
                    <div>
                      <span style={{fontSize:'13px',fontWeight:'600',color:'white'}}>{p.dose}</span>
                      <span style={{fontSize:'11px',color:dg,display:'block'}}>{p.dates}</span>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <span style={{fontSize:'13px',fontWeight:'600',color:'white'}}>{p.units}u</span>
                    <span style={{fontSize:'11px',color:dg,display:'block'}}>{p.ml}</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>WEEKLY WEIGHT LOG</div>
              {allWeeks.map(({ weekNum, phase, dateStr }) => {
                const isCurrent = weekNum === CURRENT_WEEK
                const isPast = weekNum < CURRENT_WEEK
                const isActive = isCurrent || isPast
                const weight = weights[weekNum]
                const prevWeeks = Object.keys(validWeights).map(Number).filter(w => w < weekNum).sort((a, b) => b - a)
                const prevWeight = prevWeeks.length ? validWeights[prevWeeks[0] as any] : null
                const change = weight && prevWeight ? (weight - prevWeight).toFixed(1) : null
                return (
                  <div key={weekNum} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid '+bd,opacity:isActive?1:0.3}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <div style={{width:'28px',height:'28px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',background:isCurrent?'#6c63ff':weight?'rgba(57,255,20,0.15)':'transparent',color:isCurrent?'white':weight?g:dg,border:isCurrent?'none':'1px solid '+bd}}>{weekNum}</div>
                      <div>
                        <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{dateStr}{isCurrent ? ' ← current' : ''}</span>
                        <span style={{fontSize:'11px',color:dg,display:'block'}}>{phase?.dose} · {phase?.units}u</span>
                      </div>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                      {change && <span style={{fontSize:'11px',fontWeight:'600',color:parseFloat(change)<0?g:'#ff6b6b'}}>{parseFloat(change)>0?'+':''}{change}</span>}
                      {isActive && editingWeek === weekNum ? (
                        <div style={{display:'flex',gap:'4px'}}>
                          <input type='number' step='0.1' value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSaveWeight(weekNum)} style={{width:'70px',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'4px 6px',color:'white',fontSize:'12px',textAlign:'center'}} autoFocus />
                          <button onClick={() => handleSaveWeight(weekNum)} style={{background:g,color:'#000',border:'none',borderRadius:'4px',padding:'4px 8px',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>✓</button>
                        </div>
                      ) : isActive ? (
                        <button onClick={() => { setEditingWeek(weekNum); setInputVal(weight?String(weight):'') }} style={{fontSize:'12px',fontWeight:'600',padding:'4px 10px',borderRadius:'6px',cursor:'pointer',border:'1px solid '+(weight?'rgba(57,255,20,0.3)':bd),background:weight?'rgba(57,255,20,0.05)':'transparent',color:weight?g:dg}}>{weight ? weight+' lbs' : 'tap'}</button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* CJC */}
        {activeTab === 'cjc' && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'4px'}}>CJC-1295 / IPAMORELIN</div>
            <p style={{fontSize:'11px',color:dg,marginBottom:'12px'}}>Before bed · 5 on / 2 off · 13 units · ~333mcg each</p>
            {cjcLog.map((e, idx) => (
              <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid '+bd,opacity:e.done?1:0.5}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',background:e.done?'rgba(59,130,246,0.2)':'transparent',color:e.done?'#3b82f6':dg,border:'1px solid '+(e.done?'#3b82f6':bd)}}>{e.night}</div>
                  <span style={{fontSize:'13px',color:'white'}}>{e.date} · {e.units}u</span>
                </div>
                <button onClick={() => toggleCjc(idx)} style={{fontSize:'11px',fontWeight:'700',padding:'4px 10px',borderRadius:'12px',cursor:'pointer',border:'none',background:e.done?'rgba(59,130,246,0.2)':'rgba(255,255,255,0.05)',color:e.done?'#3b82f6':dg}}>{e.done?'✓ Done':'Tap'}</button>
              </div>
            ))}
          </div>
        )}

        {/* HCG */}
        {activeTab === 'hcg' && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'4px'}}>HCG — PUBERGEN HP 10,000 IU</div>
            <p style={{fontSize:'11px',color:dg,marginBottom:'12px'}}>Morning · SubQ · 500→250 IU · Reconstituted Apr 20</p>
            {hcgLog.map((e, idx) => (
              <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid '+bd,opacity:e.done?1:0.5}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',background:e.done?'rgba(139,92,246,0.2)':'transparent',color:e.done?'#8b5cf6':dg,border:'1px solid '+(e.done?'#8b5cf6':bd)}}>{e.dose}</div>
                  <div><span style={{fontSize:'13px',color:'white'}}>{e.date} ({e.day})</span><span style={{fontSize:'11px',color:dg,display:'block'}}>{e.units}u · {e.iu} IU · {e.note}</span></div>
                </div>
                <button onClick={() => toggleHcg(idx)} style={{fontSize:'11px',fontWeight:'700',padding:'4px 10px',borderRadius:'12px',cursor:'pointer',border:'none',background:e.done?'rgba(139,92,246,0.2)':'rgba(255,255,255,0.05)',color:e.done?'#8b5cf6':dg}}>{e.done?'✓ Done':'Tap'}</button>
              </div>
            ))}
          </div>
        )}

        {/* GHK */}
        {activeTab === 'ghk' && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'4px'}}>GHK-Cu — 50MG VIAL</div>
            <p style={{fontSize:'11px',color:dg,marginBottom:'12px'}}>SubQ morning · 3ml BAC · 10→20 units daily</p>
            {ghkLog.map((e, idx) => (
              <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid '+bd,opacity:e.done?1:0.5}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',background:e.done?'rgba(20,184,166,0.2)':'transparent',color:e.done?'#14b8a6':dg,border:'1px solid '+(e.done?'#14b8a6':bd)}}>{e.dose}</div>
                  <div><span style={{fontSize:'13px',color:'white'}}>{e.date} ({e.day})</span><span style={{fontSize:'11px',color:dg,display:'block'}}>{e.units}u · {e.mg} · {e.note}</span></div>
                </div>
                <button onClick={() => toggleGhk(idx)} style={{fontSize:'11px',fontWeight:'700',padding:'4px 10px',borderRadius:'12px',cursor:'pointer',border:'none',background:e.done?'rgba(20,184,166,0.2)':'rgba(255,255,255,0.05)',color:e.done?'#14b8a6':dg}}>{e.done?'✓ Done':'Tap'}</button>
              </div>
            ))}
          </div>
        )}

        {/* WOLVERINE */}
        {activeTab === 'wolverine' && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'4px'}}>BPC-157 / TB-500 BLEND</div>
            <p style={{fontSize:'11px',color:dg,marginBottom:'12px'}}>Morning · Every 3 days · SubQ · 3ml BAC</p>
            {wolverineLog.map((e, idx) => (
              <div key={idx} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid '+bd,opacity:e.done?1:0.5}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <div style={{width:'24px',height:'24px',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',background:e.done?'rgba(249,115,22,0.2)':'transparent',color:e.done?'#f97316':dg,border:'1px solid '+(e.done?'#f97316':bd)}}>{e.shot}</div>
                  <div><span style={{fontSize:'13px',color:'white'}}>{e.date}</span><span style={{fontSize:'11px',color:dg,display:'block'}}>{e.units}u · BPC {e.bpc} · TB {e.tb}</span></div>
                </div>
                <button onClick={() => toggleWolverine(idx)} style={{fontSize:'11px',fontWeight:'700',padding:'4px 10px',borderRadius:'12px',cursor:'pointer',border:'none',background:e.done?'rgba(249,115,22,0.2)':'rgba(255,255,255,0.05)',color:e.done?'#f97316':dg}}>{e.done?'✓ Done':'Tap'}</button>
              </div>
            ))}
          </div>
        )}

        <div style={{marginTop:'16px',background:cb,borderRadius:'12px',padding:'14px',textAlign:'center'}}>
          <p style={{fontSize:'11px',color:dg}}>Peru May 1-16 · All protocols paused · Resume May 16</p>
        </div>
      </div>
    </main>
  )
}