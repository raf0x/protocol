'use client'
import { formatProtocolAmount, formatProtocolNumber, formatProtocolPercent } from '../../lib/health/dosingEntry'
import { recordedDoseDisplay } from '../../lib/health/recordedDose'
import { currentPhase as selectCurrentPhase } from '../../lib/health/dosing'
import type { PhaseRow } from '../../lib/health/timeline'
import React, { useState } from 'react'
import { expiredLatestPhase } from '../../lib/health/phaseLifecycle'
import { createClient } from '../../lib/supabase'
import { continueLatestPhase, transitionProtocol } from '../../lib/health/protocolMutations'
import VialInventory from './VialInventory'
import styles from './HeroProtocolCard.module.css'
import { heroAdministration, heroDoseCount, heroNextDose } from '../../lib/health/heroPresentation'
import { localCalendarDate, protocolLifecycle } from '../../lib/health/protocolDates'
import { useLocalCalendarDate } from '../../lib/health/useLocalCalendarDate'
import { dateLabel } from '../../lib/health/protocolPresentation'
import { phaseDosingIssue } from '../../lib/health/dosingGuidance'
import { preparationPresentation } from '../../lib/health/preparationPresentation'
import { currentVialSafety } from '../../lib/health/vialSafety'
import SelectedProtocolSnapshot from '../today/SelectedProtocolSnapshot'
import EnhancedVial from '../today/EnhancedVial'

type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  logs: Record<string, LogEntry>
  allLogs: { compound_id: string; taken: boolean; date: string }[]
  totalLost: string | null
  compoundIndex: number
  snapshot?: boolean
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

function DynamicVial({ name, color, fillPct, vialStrength, vialUnit }: { name: string; color: string; fillPct: number; vialStrength?: number; vialUnit?: string }) {
  const strengthText = formatProtocolAmount(vialStrength, vialUnit)
  const short = name.split('/')[0].split('-')[0].split(' ')[0].slice(0, 7)
  const fill = Math.max(0, Math.min(1, fillPct))
  const W = 80; const H = 160; const capH = 18; const neckH = 12; const neckW = 28
  const bodyX = 10; const bodyY = capH + neckH; const bodyW = W - 20; const bodyH = H - bodyY - 16
  const fillH = bodyH * fill; const fillY = bodyY + bodyH - fillH
  const id = React.useId().replace(/:/g, '')
  
  const ribbonY = bodyY + bodyH * 0.35
  const ribbonH = 24
  
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
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill={color} opacity='0.9'/>
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill='var(--color-text)' opacity='0.12'/>
      <rect x={(W - neckW) / 2} y={capH} width={neckW} height={neckH + 2} rx='3' fill={color} opacity='0.45'/>
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6' fill='var(--color-input)' stroke={color} strokeWidth='1.2' strokeOpacity='0.7'/>
      {fillH > 0 && <rect x={bodyX} y={fillY} width={bodyW} height={fillH} clipPath={`url(#clip-${id})`} fill={`url(#fill-${id})`}/>}
      {fillH > 2 && <rect x={bodyX + 1} y={fillY} width={bodyW - 2} height='2.5' fill={color} opacity='0.6' clipPath={`url(#clip-${id})`}/>}
      <rect x={bodyX + 3} y={bodyY + 4} width='5' height={bodyH - 12} rx='2.5' fill='var(--color-text)' opacity='0.06'/>
      {[0.25, 0.5, 0.75].map((tick) => (
        <line key={tick} x1={bodyX + bodyW - 1} y1={bodyY + bodyH * (1 - tick)} x2={bodyX + bodyW + 8} y2={bodyY + bodyH * (1 - tick)} stroke={color} strokeWidth='1.5' opacity='0.8'/>
      ))}
      
      <g>
        <rect x={bodyX - 2} y={ribbonY} width={bodyW + 4} height={ribbonH} fill='rgba(0,0,0,0.85)' />
        <rect x={bodyX - 2} y={ribbonY} width={bodyW + 4} height={ribbonH} fill={color} opacity='0.15' />
        <rect x={bodyX - 2} y={ribbonY} width={bodyW + 4} height='1' fill={color} opacity='0.6' />
        <rect x={bodyX - 2} y={ribbonY + ribbonH - 1} width={bodyW + 4} height='1' fill={color} opacity='0.6' />
        
        <text x={W/2} y={ribbonY + 10} textAnchor='middle' fontSize='7' fontWeight='800' fill='var(--color-text)' fontFamily='Inter,system-ui,sans-serif' opacity='0.9'>
          {short.toUpperCase()}
        </text>
        {strengthText && (
          <text x={W/2} y={ribbonY + 18} textAnchor='middle' fontSize='8' fontWeight='900' fill={color} fontFamily='Inter,system-ui,sans-serif'>
            {strengthText}
          </text>
        )}
      </g>
      
      <text x={W/2} y={ribbonY + ribbonH + 24} textAnchor='middle' fontSize='12' fontWeight='900' fill='var(--color-text)' fontFamily='Inter,system-ui,sans-serif'>{formatProtocolPercent(fill*100) ?? 'Not recorded'}</text>
      <rect x={bodyX + 2} y={bodyY + bodyH - 2} width={bodyW - 4} height='4' rx='2' fill={color} opacity='0.15'/>
    </svg>
  )
}

const RING_COLORS = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635']

export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost, compoundIndex, snapshot = false }: Props) {
  const today = useLocalCalendarDate()
  const [continuing,setContinuing]=useState(false)
  const [phaseError,setPhaseError]=useState('')
  const [dosesRefresh, setDosesRefresh] = React.useState(0)
  const [confirmArchive, setConfirmArchive] = React.useState(false)
  const [continuity, setContinuity] = React.useState<{ name: string; start_date: string; completed_date: string } | null>(null)
  
  React.useEffect(() => {
    function onStorage(e: StorageEvent) { if (e.key?.includes('_doses')) setDosesRefresh(n => n + 1) }
    window.addEventListener('storage', onStorage)
    function onDoses() { setDosesRefresh(n => n + 1) }
    window.addEventListener('doses_updated', onDoses)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('doses_updated', onDoses) }
  }, [])

  // Resolve which protocol is active (same logic as render below), then load its continuity link
  let effectProtocolId: string | null = null
  for (const p of (activeProtocols || [])) {
    if ((p.compounds || []).some((c: any) => c.id === activeCompoundTab)) { effectProtocolId = p.id; break }
  }
  if (!effectProtocolId) effectProtocolId = activeProtocols?.[0]?.id ?? null

  React.useEffect(() => {
    let cancelled = false
    async function loadContinuity() {
      setContinuity(null)
      if (!effectProtocolId) return
      try {
        const supabase = createClient()
        const { data: proto } = await supabase.from('protocols').select('continued_from_protocol_id').eq('id', effectProtocolId).single()
        if (!proto?.continued_from_protocol_id) return
        const { data: prev } = await supabase.from('protocols').select('name, start_date, completed_date').eq('id', proto.continued_from_protocol_id).single()
        if (prev && prev.completed_date && !cancelled) setContinuity(prev)
      } catch (e) { /* badge is cosmetic; fail silently */ }
    }
    loadContinuity()
    return () => { cancelled = true }
  }, [effectProtocolId])
  
  if (!activeProtocols || activeProtocols.length === 0) return null

  let activeCompound: any = null
  let activeProtocol: any = null
  for (const p of activeProtocols) {
    for (const c of (p.compounds || [])) {
      if (c.id === activeCompoundTab) { activeCompound = c; activeProtocol = p; break }
    }
    if (activeCompound) break
  }
  if (!activeCompound) {
    activeProtocol = activeProtocols[0]
    activeCompound = activeProtocol?.compounds?.[0]
  }
  if (!activeCompound || !activeProtocol) return null
  const scheduled = protocolLifecycle(activeProtocol, today) === 'scheduled'

  const color = RING_COLORS[compoundIndex] || RING_COLORS[0]

  const daysIn = Math.max(0, Math.floor((Date.now() - new Date(activeProtocol.start_date + 'T00:00:00').getTime()) / 86400000))
  const compoundWeek = Math.max(1, Math.floor(daysIn / 7) + 1)

  let totalDosesEstimate = 0
  const dosesOverride = activeCompound.doses_taken_override ?? null
  const allPhases = [...(activeCompound.phases || [])].sort((a: any, b: any) => a.start_week - b.start_week)
  for (const ph of allPhases) {
    const phaseWeeks = ph.end_week - ph.start_week + 1
    const dosesPerWeek = ph.frequency === 'daily' ? 7 : ph.frequency === 'eod' ? 3.5 : ph.frequency === 'every3days' ? 2.3 : ph.frequency === '1x/week' ? 1 : ph.frequency === '2x/week' ? 2 : ph.frequency === '3x/week' ? 3 : ph.frequency === '4x/week' ? 4 : ph.frequency === '5x/week' ? 5 : 2
    totalDosesEstimate += phaseWeeks * dosesPerWeek
  }
  const lastPhaseForProgress = [...(activeCompound.phases || [])].sort((a: any, b: any) => b.end_week - a.end_week)[0]
  const totalDaysForProgress = lastPhaseForProgress ? lastPhaseForProgress.end_week * 7 : 84
  const progress = dosesOverride !== null && totalDosesEstimate > 0
    ? Math.min(100, Math.round((dosesOverride / totalDosesEstimate) * 100))
    : Math.min(100, Math.round((daysIn / totalDaysForProgress) * 100))

  const currentPhase = selectCurrentPhase(activeCompound.phases as PhaseRow[] || [], activeProtocol.start_date, new Date().toLocaleDateString('en-CA'))
  const nextDoseDate = heroNextDose(activeProtocol, activeCompound, allLogs, today)
  const doseCount = heroDoseCount(activeCompound.id, activeCompound.doses_taken_override, allLogs, today)
  const entry = currentPhase?.dosing_entry
  const administrationText = heroAdministration(currentPhase)
  const preparation = preparationPresentation(activeCompound, currentPhase)
  const vialSafety = currentVialSafety(activeCompound, entry)
  const stock = activeCompound.vials_in_stock
  const stockText = (typeof stock === 'number' || typeof stock === 'string' && stock.trim()) && Number.isSafeInteger(Number(stock)) && Number(stock) >= 0 ? formatProtocolNumber(stock, 'count') : null
  const facts = [
    ...(preparation.recordedDate ? [{ label: 'Reconstituted', value: dateLabel(preparation.recordedDate) }] : []),
    ...(preparation.checkReminder ? [{ label: '28-day check', value: dateLabel(preparation.checkReminder) }] : []),
    ...(administrationText.volume ? [administrationText.volume] : []),
    { label: 'Doses taken', value: doseCount.value },
    { label: 'Next dose', value: nextDoseDate ? dateLabel(nextDoseDate) : 'Schedule not set' },
    ...(stockText !== null ? [{ label: 'Vials in stock', value: stockText }] : []),
  ]
  const vialRecovery = <details className={styles.explanation} data-vial-remaining-reason><summary>About these details</summary>
    <p>Saved preparation facts do not confirm the current physical vial.</p>
    {preparation.checkReminder && <p>28-day check reminder: {dateLabel(preparation.checkReminder)}. Tracking only; not an expiration or safe-use date.</p>}
    {!preparation.recordedDate && <p>Reconstitution date not recorded.</p>}
    {administrationText.notes.map(note => <p key={note}>{note}</p>)}
    <p>{doseCount.note}</p><p>{vialSafety.reasons.join(' ')}</p>
  </details>

  const expired=expiredLatestPhase(activeCompound.phases || [],activeProtocol.status || 'active',activeProtocol.start_date,new Date().toLocaleDateString('en-CA'))
  async function continueLatest() {
    if(!expired) return
    setContinuing(true);setPhaseError('')
    try {
      await continueLatestPhase({protocolId:activeProtocol.id,compoundId:activeCompound.id,phaseId:expired.id})
      window.location.reload()
    } catch(error) {setPhaseError((error as {message?:string}).message || 'Unable to continue the phase. Please retry.');setContinuing(false)}

  }
  const dosePresentation = recordedDoseDisplay(currentPhase)
  const doseIssue = phaseDosingIssue(currentPhase)
  const badgeDoseText = dosePresentation.medication ? dosePresentation.primary : administrationText.syringe || dosePresentation.primary
  const doseNotice = doseIssue?.severity === 'warning' ? <><strong>{doseIssue.title}</strong><p>{doseIssue.explanation}</p></> : null
  const reviewHref = `/protocol/manage?compound=${activeCompound.id}${doseIssue?.action ? '&review=' + encodeURIComponent(doseIssue.field) : ''}`

  async function archiveProtocol() {
    const completionDate = localCalendarDate()
    if (protocolLifecycle(activeProtocol, completionDate) === 'scheduled') return
    await transitionProtocol({protocolId:activeProtocol.id,action:'complete',effectiveDate:completionDate})
    window.location.reload()
  }

  const vialInventory = <VialInventory presentation="action" compoundId={activeCompound.id} compoundName={activeCompound.name} reconstitutionDate={activeCompound.reconstitution_date} bacWaterMl={activeCompound.bac_water_ml} vialStrength={activeCompound.vial_strength} vialUnit={activeCompound.vial_unit} />

  return (
    <div className={styles.hero + (snapshot ? ' today-selected-protocol' : '')} style={{position:'relative'}}>
      {snapshot ? <SelectedProtocolSnapshot
        name={activeCompound.name} protocolName={activeProtocol.name} medication={badgeDoseText || 'Medication amount unknown'} frequency={currentPhase?.frequency}
        medicationKnown={Boolean(dosePresentation.medication)} week={compoundWeek} started={dateLabel(activeProtocol.start_date)} color={color}
        facts={facts}

        visual={<EnhancedVial name={activeCompound.name} strength={preparation.amount?.value} unit={preparation.amount?.unit} strengthLabel={preparation.label} remainingFraction={vialSafety.remainingFraction} remainingMl={vialSafety.remainingMl} />}
        notice={doseNotice}
        actions={<>
          {expired && <><button disabled={continuing} onClick={continueLatest}>{continuing ? 'Continuing…' : 'Continue latest phase'}</button><a href={`/protocol/manage?compound=${activeCompound.id}&action=add-phase`}>Add new phase</a>{phaseError && <p role="alert">{phaseError}</p>}</>}
          <a href={reviewHref}>{doseIssue?.action ?? 'Manage protocol'}</a>
          <a href="/protocol/inventory">Inventory</a>
        </>}
      /> : <>
      <div style={{position:'absolute',top:'-20px',right:'-20px',width:'140px',height:'140px',borderRadius:'50%',background:color.replace('#','rgba(') + ',0.08)',filter:'blur(40px)',pointerEvents:'none'}} />

      <div className={styles.fullHeading} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:'11px',fontWeight:'800',color:'var(--color-text)',letterSpacing:'2px',marginBottom:'6px'}}>ACTIVE COMPOUND</div>
          <h2 style={{fontSize:'22px',fontWeight:'900',color:'var(--color-text)',marginBottom:'8px',lineHeight:'1.2'}}>{activeCompound.name}</h2>

          <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'8px',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',fontWeight:'700',color:color,background:color+'18',padding:'3px 8px',borderRadius:'20px'}}>Week {compoundWeek}</span>
            <span style={{fontSize:'12px',color:'var(--color-dim)'}}>Started {new Date(activeProtocol.start_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {continuity && (() => {
              const prevDays = Math.max(0, Math.round((new Date(continuity.completed_date).getTime() - new Date(continuity.start_date + 'T00:00:00').getTime()) / 86400000))
              const prevWeeks = Math.round(prevDays / 7)
              const breakDays = Math.max(0, Math.round((new Date(activeProtocol.start_date + 'T00:00:00').getTime() - new Date(continuity.completed_date).getTime()) / 86400000))
              const breakWeeks = Math.round(breakDays / 7)
              const shortPrev = continuity.name.replace(/^Demo:\s*/i, '').split(' ')[0]
              return (
                <span title={`Continuing ${continuity.name} — previously ${prevWeeks} weeks, ended ${new Date(continuity.completed_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`} style={{fontSize:'11px',fontWeight:'700',color:'#a78bfa',background:'rgba(139,92,246,0.12)',padding:'3px 8px',borderRadius:'20px'}}>
                  ↻ {prevWeeks} wks prior on {shortPrev}{breakWeeks >= 1 ? ` · ${breakWeeks} wk break` : ''}
                </span>
              )
            })()}
          </div>

          {expired && <div style={{fontSize:13,color:'var(--color-dim)'}}><p>Your latest dose phase ended. Continue it as ongoing or add a new phase.</p><button disabled={continuing} onClick={continueLatest} style={{color:'var(--color-green)',background:'none',border:'1px solid var(--color-border)',borderRadius:6,padding:'6px 10px'}}>{continuing ? 'Continuing…':'Continue latest phase'}</button>{' '}<a href={`/protocol/manage?compound=${activeCompound.id}&action=add-phase`} style={{color:'var(--color-green)'}}>Add new phase</a>{phaseError && <p role="alert">{phaseError}</p>}</div>}
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
            {currentPhase && (
              <span style={{fontSize:'13px',fontWeight:'800',color:'#0a0a0f',background:'linear-gradient(135deg,'+color+', '+color+'cc)',padding:'4px 10px',borderRadius:'20px',boxShadow:'0 2px 8px '+color+'40',whiteSpace:'nowrap'}}>
                {badgeDoseText}
                {dosePresentation.medication && '/dose'}
              </span>
            )}
            {currentPhase && (
              <span style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600'}}>{currentPhase.frequency}</span>
            )}
          </div>
          {!expired && (!currentPhase ? <a href={`/protocol/manage?protocol=${activeProtocol.id}`} style={{color:'var(--color-green)',fontSize:13}}>Add or extend a phase.</a> : doseNotice && <div style={{display:'grid',gap:4,marginBottom:12,fontSize:13}}><div>{doseNotice}</div>{doseIssue?.action && <a href={reviewHref} style={{color:'var(--color-green)'}}>{doseIssue.action}</a>}</div>)}
        </div>

        <div className={styles.fullVisual} style={{marginLeft:'16px',flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.5))'}}>
          <EnhancedVial name={activeCompound.name} strength={preparation.amount?.value} unit={preparation.amount?.unit} strengthLabel={preparation.label} remainingFraction={vialSafety.remainingFraction} remainingMl={vialSafety.remainingMl} />
          {scheduled && <p style={{fontSize:'12px',maxWidth:'160px',textAlign:'center'}}>Scheduled to begin {dateLabel(activeProtocol.start_date)}.</p>}
        </div>
      </div>

      <dl className={styles.facts}>
        {facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
      </dl>
      </>}

      {administrationText.issue && <p role="status" className={styles.issue}>{administrationText.issue} <a href={reviewHref}>Review measurements</a></p>}
      {dosePresentation.medication && administrationText.syringe && <p className={styles.syringe}>Syringe: {administrationText.syringe}</p>}
      {vialSafety.invalidFacts.map(reason => <p key={reason} role="status" data-vial-invalid>{reason}</p>)}
      {doseIssue?.severity === 'info' && <p data-dose-information style={{fontSize:13,color:'var(--color-dim)'}}>{doseIssue.title}. {doseIssue.explanation}</p>}
      {vialRecovery}
      {vialInventory && (
        <div className={styles.vialAction}>
          {vialInventory}
        </div>
      )}

      {confirmArchive && !scheduled && (
        <div style={{background:'rgba(0,0,0,0.85)',position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={() => setConfirmArchive(false)}>
          <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'16px',padding:'24px',maxWidth:'380px',width:'100%'}} onClick={e => e.stopPropagation()}>
            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px',color:'#39ff14'}}>Mark as Complete?</h3>
            <p style={{fontSize:'14px',color:'var(--color-dim)',marginBottom:'20px',lineHeight:'1.5'}}>Archive <strong>{activeCompound.name}</strong> and mark this protocol phase complete. All data will be preserved.</p>
            <div style={{display:'flex',gap:'10px'}}>
              <button onClick={() => setConfirmArchive(false)} style={{flex:1,background:'var(--color-card)',color:'var(--color-dim)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={() => { archiveProtocol(); setConfirmArchive(false) }} style={{flex:1,background:'#22c55e',color:'#000',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>Complete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
