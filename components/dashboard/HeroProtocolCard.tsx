'use client'
import React from 'react'
import CompoundNotes from './CompoundNotes'
import VialInventory from './VialInventory'

type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  logs: Record<string, LogEntry>
  allLogs: { compound_id: string; taken: boolean; date: string }[]
  totalLost: string | null
  compoundIndex: number
  onShare: (protocolId: string) => void
}

const COMPOUND_COLORS: Record<string, string> = {
  retatrutide: '#39ff14', semaglutide: '#39ff14', tirzepatide: '#39ff14', liraglutide: '#39ff14',
  bpc: '#06b6d4', tb: '#06b6d4', cjc: '#8b5cf6', ipamorelin: '#8b5cf6',
  ghk: '#f59e0b', hcg: '#f97316', mots: '#f43f5e', kpv: '#a3e635',
}

function getCompoundColor(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, color] of Object.entries(COMPOUND_COLORS)) {
    if (lower.includes(key)) return color
  }
  return '#6c63ff'
}

function DynamicVial({ name, color, fillPct }: { name: string; color: string; fillPct: number }) {
  const short = name.split('/')[0].split('-')[0].split(' ')[0].slice(0, 7)
  const fill = Math.max(0, Math.min(1, fillPct))
  const W = 80; const H = 160; const capH = 18; const neckH = 12; const neckW = 28
  const bodyX = 10; const bodyY = capH + neckH; const bodyW = W - 20; const bodyH = H - bodyY - 16
  const fillH = bodyH * fill; const fillY = bodyY + bodyH - fillH
  const id = short.replace(/[^a-z0-9]/gi, '') + Math.random().toString(36).slice(2,5)
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <defs>
        <linearGradient id={`fill-${id}`} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={color} stopOpacity='0.7'/>
          <stop offset='100%' stopColor={color} stopOpacity='0.35'/>
        </linearGradient>
        <clipPath id={`clip-${id}`}>
          <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6'/>
        </clipPath>
      </defs>
      {/* Cap */}
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill={color} opacity='0.9'/>
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill='var(--color-text)' opacity='0.12'/>
      {/* Neck */}
      <rect x={(W - neckW) / 2} y={capH} width={neckW} height={neckH + 2} rx='3' fill={color} opacity='0.45'/>
      {/* Body */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6' fill='var(--color-input)' stroke={color} strokeWidth='1.2' strokeOpacity='0.7'/>
      {/* Liquid */}
      {fillH > 0 && <rect x={bodyX} y={fillY} width={bodyW} height={fillH} clipPath={`url(#clip-${id})`} fill={`url(#fill-${id})`}/>}
      {/* Liquid surface */}
      {fillH > 2 && <rect x={bodyX + 1} y={fillY} width={bodyW - 2} height='2.5' fill={color} opacity='0.6' clipPath={`url(#clip-${id})`}/>}
      {/* Glass shine */}
      <rect x={bodyX + 3} y={bodyY + 4} width='5' height={bodyH - 12} rx='2.5' fill='var(--color-text)' opacity='0.06'/>
      {/* Tick marks */}
      {[0.25, 0.5, 0.75].map((tick) => (
        <line key={tick} x1={bodyX + bodyW - 1} y1={bodyY + bodyH * (1 - tick)} x2={bodyX + bodyW + 8} y2={bodyY + bodyH * (1 - tick)} stroke={color} strokeWidth='1.5' opacity='0.8'/>
      ))}
      {/* Label */}
      <text x={W/2} y={bodyY + bodyH * 0.42} textAnchor='middle' fontSize='8' fontWeight='800' fill={color} fontFamily='Inter,system-ui,sans-serif' opacity='0.9'>{short}</text>
      <text x={W/2} y={bodyY + bodyH * 0.42 + 16} textAnchor='middle' fontSize='12' fontWeight='900' fill='var(--color-text)' fontFamily='Inter,system-ui,sans-serif'>{Math.round(fill*100)}%</text>
      {/* Base */}
      <rect x={bodyX + 2} y={bodyY + bodyH - 2} width={bodyW - 4} height='4' rx='2' fill={color} opacity='0.15'/>
    </svg>
  )
}

const RING_COLORS = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635']

export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost, compoundIndex, onShare }: Props) {
  const [dosesRefresh, setDosesRefresh] = React.useState(0)
  React.useEffect(() => {
    function onStorage(e: StorageEvent) { if (e.key?.includes('_doses')) setDosesRefresh(n => n + 1) }
    window.addEventListener('storage', onStorage)
    // Also listen for custom event from same tab
    function onDoses() { setDosesRefresh(n => n + 1) }
    window.addEventListener('doses_updated', onDoses)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('doses_updated', onDoses) }
  }, [])
  if (!activeProtocols || activeProtocols.length === 0) return null

  // Find the active compound across all protocols
  let activeCompound: any = null
  let activeProtocol: any = null
  for (const p of activeProtocols) {
    for (const c of (p.compounds || [])) {
      if (c.id === activeCompoundTab) { activeCompound = c; activeProtocol = p; break }
    }
    if (activeCompound) break
  }
  // Fallback to first compound
  if (!activeCompound) {
    activeProtocol = activeProtocols[0]
    activeCompound = activeProtocol?.compounds?.[0]
  }
  if (!activeCompound || !activeProtocol) return null

  const color = RING_COLORS[compoundIndex] || RING_COLORS[0]

  // Correct week for this specific compound's protocol
  const daysIn = Math.max(0, Math.floor((Date.now() - new Date(activeProtocol.start_date + 'T00:00:00').getTime()) / 86400000))
  const compoundWeek = Math.max(1, Math.floor(daysIn / 7) + 1)

  // Protocol progress - dose based if override exists, otherwise time based
  let totalDosesEstimate = 0
  const dosesOverride = activeCompound.doses_taken_override ?? null
  const allPhases = (activeCompound.phases || []).sort((a: any, b: any) => a.start_week - b.start_week)
  for (const ph of allPhases) {
    const phaseWeeks = ph.end_week - ph.start_week + 1
    const dosesPerWeek = ph.frequency === 'daily' ? 7 : ph.frequency === 'eod' ? 3.5 : ph.frequency === 'every3days' ? 2.3 : ph.frequency === '1x/week' ? 1 : ph.frequency === '2x/week' ? 2 : ph.frequency === '3x/week' ? 3 : ph.frequency === '4x/week' ? 4 : ph.frequency === '5x/week' ? 5 : 2
    totalDosesEstimate += phaseWeeks * dosesPerWeek
  }
  const lastPhaseForProgress = (activeCompound.phases || []).sort((a: any, b: any) => b.end_week - a.end_week)[0]
  const totalDaysForProgress = lastPhaseForProgress ? lastPhaseForProgress.end_week * 7 : 84
  const progress = dosesOverride !== null && totalDosesEstimate > 0
    ? Math.min(100, Math.round((dosesOverride / totalDosesEstimate) * 100))
    : Math.min(100, Math.round((daysIn / totalDaysForProgress) * 100))

  // Current phase
  const currentPhase = (activeCompound.phases || []).find((ph: any) => compoundWeek >= ph.start_week && compoundWeek <= ph.end_week) || activeCompound.phases?.[0]

  // Vial status
  const reconDate = activeCompound.reconstitution_date
  const bacWater = activeCompound.bac_water_ml || 0
  const vialStrength = activeCompound.vial_strength || 0
  let vialDaysLeft: number | null = null
  let mlRemaining: number | null = null
  let fillPct = 1

  if (reconDate && bacWater > 0 && currentPhase) {
    const daysSinceRecon = Math.floor((Date.now() - new Date(reconDate + 'T00:00:00').getTime()) / 86400000)
    vialDaysLeft = 28 - daysSinceRecon

  // Use doses_taken_override from Supabase directly - no localStorage
  const totalDosesTaken = dosesOverride !== null
    ? dosesOverride
    : allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken).length
  // vial_unit='IU' means real IU vial (HCG) - use concentration math
  // vial_unit='mg' means mg vial with IU syringe units (Reta, CJC etc) - use /100
  // Use ml_per_dose directly if set - most reliable method
  const mlPerDoseStored = activeCompound.ml_per_dose || null
  const vialUnit = activeCompound.vial_unit || 'mg'
  const mlPerDose = mlPerDoseStored !== null
    ? mlPerDoseStored
    : vialUnit === 'IU' && vialStrength > 0 && bacWater > 0
      ? currentPhase.dose / (vialStrength / bacWater)
      : currentPhase.dose_unit === 'IU'
        ? currentPhase.dose / 100
        : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)
  const mlUsed = totalDosesTaken * mlPerDose
  mlRemaining = Math.max(0, bacWater - mlUsed)
  fillPct = bacWater > 0 ? mlRemaining / bacWater : 1
  }

  return (
    <div style={{background:'var(--color-surface)',borderRadius:'16px',padding:'20px',marginBottom:'16px',overflow:'hidden',position:'relative',border:'1px solid var(--color-border)',transition:'all 0.3s ease'}}>
      <div style={{position:'absolute',top:'-20px',right:'-20px',width:'140px',height:'140px',borderRadius:'50%',background:color.replace('#','rgba(') + ',0.08)',filter:'blur(40px)',pointerEvents:'none'}} />

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'2px',marginBottom:'6px'}}>ACTIVE COMPOUND</div>
          <h2 style={{fontSize:'22px',fontWeight:'900',color:'var(--color-text)',marginBottom:'8px',lineHeight:'1.2'}}>{activeCompound.name}</h2>

          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'14px',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',fontWeight:'700',color:color,background:color+'18',padding:'3px 8px',borderRadius:'20px'}}>Week {compoundWeek}</span>
            {currentPhase && <span style={{fontSize:'12px',color:'var(--color-dim)'}}>{currentPhase.dose}{currentPhase.dose_unit} · {currentPhase.frequency}</span>}
            {totalLost && parseFloat(totalLost) > 0 && (
              <span style={{fontSize:'12px',fontWeight:'700',color:'#f59e0b',background:'rgba(245,158,11,0.1)',padding:'3px 8px',borderRadius:'20px'}}>-{totalLost} lbs</span>
            )}
          </div>

          {vialDaysLeft !== null && mlRemaining !== null && (
            <div style={{marginBottom:'12px',display:'flex',gap:'12px'}}>
              <div>
                <div style={{fontSize:'9px',color:'var(--color-muted)',fontWeight:'600',letterSpacing:'1px',marginBottom:'2px'}}>VIAL EXPIRES</div>
                <div style={{fontSize:'13px',fontWeight:'700',color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'white'}}>{vialDaysLeft}d left</div>
              </div>
              <div>
                <div style={{fontSize:'9px',color:'var(--color-muted)',fontWeight:'600',letterSpacing:'1px',marginBottom:'2px'}}>EST. REMAINING</div>
                <div style={{fontSize:'13px',fontWeight:'700',color:'var(--color-text)'}}>{mlRemaining.toFixed(2)} mL</div>
              </div>
            </div>
          )}

          <div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
              <span style={{fontSize:'9px',color:'var(--color-muted)',fontWeight:'600',letterSpacing:'1px'}}>PROTOCOL PROGRESS</span>
              <span style={{fontSize:'9px',color:'var(--color-dim)',fontWeight:'700'}}>{progress}%</span>
            </div>
            <div style={{height:'4px',background:'var(--color-border)',borderRadius:'2px',overflow:'hidden'}}>
              <div style={{height:'100%',width:progress+'%',background:'linear-gradient(90deg,'+color+','+color+'99)',borderRadius:'2px',transition:'width 0.5s ease'}} />
            </div>
          </div>
        </div>

        <div style={{marginLeft:'16px',flexShrink:0,filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.5))'}}>
          <DynamicVial name={activeCompound.name} color={color} fillPct={fillPct} />
        </div>
      </div>
      <div style={{marginTop:'14px',paddingTop:'14px',borderTop:'1px solid var(--color-border)'}}>
        <CompoundNotes compoundId={activeCompound.id} initialNotes={activeCompound.notes || ''} />
        <VialInventory compoundId={activeCompound.id} compoundName={activeCompound.name} reconstitutionDate={activeCompound.reconstitution_date} bacWaterMl={activeCompound.bac_water_ml} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'10px'}}>
          <a href='/protocol/manage' style={{color:'var(--color-muted)',textDecoration:'none',fontSize:'12px',fontWeight:'600'}}>+ Add / Edit Protocols →</a>
          <button onClick={() => onShare(activeProtocol.id)} style={{background:'none',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'6px 12px',color:'var(--color-dim)',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share →</button>
        </div>
      </div>
    </div>
  )
}