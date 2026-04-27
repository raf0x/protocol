'use client'
import { useState } from 'react'

type Props = {
  activeProtocols: any[]
  currentWeek: number
  totalLost: string | null
}

function VialSVG({ name, color }: { name: string; color: string }) {
  const short = name.split('/')[0].split(' ')[0].slice(0, 8)
  return (
    <svg width='64' height='100' viewBox='0 0 64 100' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <rect x='20' y='0' width='24' height='14' rx='4' fill={color} opacity='0.9'/>
      <rect x='24' y='12' width='16' height='6' rx='2' fill={color} opacity='0.7'/>
      <rect x='12' y='18' width='40' height='62' rx='8' fill='white' stroke={color} strokeWidth='1.5'/>
      <rect x='16' y='30' width='32' height='36' rx='4' fill={color} opacity='0.12'/>
      <rect x='13.5' y='52' width='37' height='27' rx='0' fill={color} opacity='0.15'/>
      <rect x='16' y='20' width='6' height='30' rx='3' fill='white' opacity='0.4'/>
      <text x='32' y='44' textAnchor='middle' fontSize='7' fontWeight='800' fill={color} fontFamily='Inter,sans-serif'>{short}</text>
      <rect x='12' y='76' width='40' height='4' rx='2' fill={color} opacity='0.2'/>
    </svg>
  )
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

export default function HeroProtocolCard({ activeProtocols, currentWeek, totalLost }: Props) {
  if (!activeProtocols || activeProtocols.length === 0) return null
  const primary = activeProtocols[0]
  const compounds = primary.compounds || []
  const daysIn = Math.max(0, Math.floor((Date.now() - new Date(primary.start_date + 'T00:00:00').getTime()) / 86400000))
  const totalDays = compounds.reduce((max: number, c: any) => {
    const lastPhase = (c.phases || []).sort((a: any, b: any) => b.end_week - a.end_week)[0]
    return Math.max(max, lastPhase ? lastPhase.end_week * 7 : 84)
  }, 84)
  const progress = Math.min(100, Math.round((daysIn / totalDays) * 100))
  return (
    <div style={{background:'linear-gradient(135deg, #111111 0%, #1a1a2e 100%)',borderRadius:'16px',padding:'20px',marginBottom:'16px',overflow:'hidden',position:'relative',border:'1px solid rgba(255,255,255,0.08)'}}>
      <div style={{position:'absolute',top:'-20px',right:'-20px',width:'120px',height:'120px',borderRadius:'50%',background:'rgba(57,255,20,0.06)',filter:'blur(30px)',pointerEvents:'none'}} />
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',marginBottom:'6px'}}>ACTIVE PROTOCOL</div>
          <h2 style={{fontSize:'20px',fontWeight:'900',color:'white',marginBottom:'4px',lineHeight:'1.2'}}>{primary.name}</h2>
          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',fontWeight:'700',color:'#39ff14',background:'rgba(57,255,20,0.1)',padding:'3px 8px',borderRadius:'20px'}}>Week {currentWeek}</span>
            {totalLost && parseFloat(totalLost) > 0 && (
              <span style={{fontSize:'12px',fontWeight:'700',color:'#f59e0b',background:'rgba(245,158,11,0.1)',padding:'3px 8px',borderRadius:'20px'}}>-{totalLost} lbs</span>
            )}
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>{compounds.length} compound{compounds.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{marginBottom:'6px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
              <span style={{fontSize:'10px',color:'rgba(255,255,255,0.4)',fontWeight:'600'}}>PROTOCOL PROGRESS</span>
              <span style={{fontSize:'10px',color:'rgba(255,255,255,0.6)',fontWeight:'700'}}>{progress}%</span>
            </div>
            <div style={{height:'4px',background:'rgba(255,255,255,0.1)',borderRadius:'2px',overflow:'hidden'}}>
              <div style={{height:'100%',width:progress+'%',background:'linear-gradient(90deg, #39ff14, #5DD879)',borderRadius:'2px'}} />
            </div>
          </div>
        </div>
        <div style={{display:'flex',marginLeft:'12px',flexShrink:0}}>
          {compounds.slice(0, 3).map((c: any, i: number) => (
            <div key={c.id} style={{marginLeft: i > 0 ? '-12px' : '0', zIndex: compounds.length - i, filter:'drop-shadow(0 4px 8px rgba(0,0,0,0.3))'}}>
              <VialSVG name={c.name} color={getCompoundColor(c.name)} />
            </div>
          ))}
        </div>
      </div>
      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'4px'}}>
        {compounds.map((c: any) => {
          const color = getCompoundColor(c.name)
          const phase = (c.phases || [])[0]
          return (
            <div key={c.id} style={{display:'flex',alignItems:'center',gap:'4px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'4px 8px'}}>
              <div style={{width:'6px',height:'6px',borderRadius:'50%',background:color,flexShrink:0}} />
              <span style={{fontSize:'11px',fontWeight:'600',color:'rgba(255,255,255,0.8)'}}>{c.name}</span>
              {phase && <span style={{fontSize:'10px',color:'rgba(255,255,255,0.4)'}}>{phase.dose}{phase.dose_unit}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}