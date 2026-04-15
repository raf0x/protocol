'use client'

import { useState } from 'react'

const DOSE_PRESETS = [0.1, 0.25, 0.5, 1, 2, 2.5, 5, 7.5, 10]
const STRENGTH_PRESETS = [1, 2, 5, 10, 15, 20]
const WATER_PRESETS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]

function SyringeVisual({ units }: { units: number }) {
  const maxUnits = 100
  const fillPct = Math.min(units / maxUnits, 1)
  const bodyH = 180
  const fillH = bodyH * fillPct
  const fillY = 20 + (bodyH - fillH)
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
      <svg width='60' height='240' viewBox='0 0 60 240'>
        {/* Needle */}
        <polygon points='28,220 32,220 30,238' fill='#8b8ba7' />
        {/* Syringe body */}
        <rect x='16' y='20' width='28' height='200' rx='4' fill='#12121a' stroke='#1e1e2e' strokeWidth='2'/>
        {/* Fill level */}
        {fillH > 0 && <rect x='18' y={fillY} width='24' height={fillH} rx='2' fill='#39ff14' opacity='0.7'/>}
        {/* Tick marks */}
        {[0,25,50,75,100].map(tick => {
          const y = 20 + bodyH * (1 - tick/100)
          return <g key={tick}>
            <line x1='44' y1={y} x2='50' y2={y} stroke='#3d3d5c' strokeWidth='1'/>
            <text x='52' y={y+4} fontSize='7' fill='#3d3d5c'>{tick}</text>
          </g>
        })}
        {/* Plunger */}
        <rect x='14' y='16' width='32' height='8' rx='2' fill='#1e1e2e' stroke='#3d3d5c' strokeWidth='1'/>
        <rect x='26' y='8' width='8' height='12' rx='2' fill='#3d3d5c'/>
      </svg>
      {units > 0 && <span style={{fontSize:'11px',color:'#8b8ba7'}}>U-100 syringe</span>}
    </div>
  )
}

export default function ReconstitutionCalculator() {
  const [dose, setDose] = useState<number|null>(null)
  const [strength, setStrength] = useState<number|null>(null)
  const [water, setWater] = useState<number|null>(null)
  const [customDose, setCustomDose] = useState('')
  const [customStrength, setCustomStrength] = useState('')
  const [customWater, setCustomWater] = useState('')
  const [showCustomDose, setShowCustomDose] = useState(false)
  const [showCustomStrength, setShowCustomStrength] = useState(false)
  const [showCustomWater, setShowCustomWater] = useState(false)

  const activeDose = showCustomDose ? parseFloat(customDose) : dose
  const activeStrength = showCustomStrength ? parseFloat(customStrength) : strength
  const activeWater = showCustomWater ? parseFloat(customWater) : water

  const hasAll = activeDose && activeStrength && activeWater && !isNaN(activeDose) && !isNaN(activeStrength) && !isNaN(activeWater)

  let concentration = 0, volumeMl = 0, syringeUnits = 0, totalMcg = 0
  if (hasAll) {
    totalMcg = activeStrength! * 1000
    concentration = totalMcg / activeWater!
    volumeMl = (activeDose! * 1000) / concentration
    syringeUnits = volumeMl * 100
  }

  const g = '#39ff14'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'

  function PresetBtn({ value, active, onClick, label }: { value: number; active: boolean; onClick: () => void; label?: string }) {
    return (
      <button onClick={onClick} style={{padding:'8px 12px',borderRadius:'8px',border:'1px solid '+(active?g:bd),background:active?'rgba(57,255,20,0.1)':cb,color:active?g:dg,fontSize:'13px',fontWeight:active?'700':'400',cursor:'pointer',transition:'all 0.15s'}}>
        {label || value}
      </button>
    )
  }

  return (
    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'520px',margin:'0 auto'}}>
        <a href='/' style={{fontSize:'13px',color:mg,textDecoration:'none',display:'block',marginBottom:'24px'}}>← Back</a>
        <h1 style={{fontSize:'26px',fontWeight:'900',marginBottom:'4px',color:g,letterSpacing:'-0.5px'}}>Pep Calculator</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'28px'}}>Select your parameters below. Not medical advice.</p>

        {/* Dose section */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'12px'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:dg,letterSpacing:'1px',marginBottom:'14px'}}>DOSE OF PEPTIDE (mg)</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            {DOSE_PRESETS.map(v => (
              <PresetBtn key={v} value={v} active={!showCustomDose && dose===v} onClick={() => { setDose(v); setShowCustomDose(false) }} />
            ))}
          </div>
          <button onClick={() => setShowCustomDose(!showCustomDose)} style={{fontSize:'12px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
            {showCustomDose ? 'Use presets' : 'Enter custom value'}
          </button>
          {showCustomDose && (
            <input type='number' value={customDose} onChange={e => setCustomDose(e.target.value)} placeholder='e.g. 0.3' style={{marginTop:'10px',width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
          )}
        </div>

        {/* Strength section */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'12px'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:dg,letterSpacing:'1px',marginBottom:'14px'}}>VIAL STRENGTH (mg)</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            {STRENGTH_PRESETS.map(v => (
              <PresetBtn key={v} value={v} active={!showCustomStrength && strength===v} onClick={() => { setStrength(v); setShowCustomStrength(false) }} />
            ))}
          </div>
          <button onClick={() => setShowCustomStrength(!showCustomStrength)} style={{fontSize:'12px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
            {showCustomStrength ? 'Use presets' : 'Enter custom value'}
          </button>
          {showCustomStrength && (
            <input type='number' value={customStrength} onChange={e => setCustomStrength(e.target.value)} placeholder='e.g. 7' style={{marginTop:'10px',width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
          )}
        </div>

        {/* Water section */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'24px'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:dg,letterSpacing:'1px',marginBottom:'14px'}}>BACTERIOSTATIC WATER (mL)</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            {WATER_PRESETS.map(v => (
              <PresetBtn key={v} value={v} active={!showCustomWater && water===v} onClick={() => { setWater(v); setShowCustomWater(false) }} />
            ))}
          </div>
          <button onClick={() => setShowCustomWater(!showCustomWater)} style={{fontSize:'12px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
            {showCustomWater ? 'Use presets' : 'Enter custom value'}
          </button>
          {showCustomWater && (
            <input type='number' value={customWater} onChange={e => setCustomWater(e.target.value)} placeholder='e.g. 1.2' style={{marginTop:'10px',width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
          )}
        </div>

        {/* Results */}
        <div style={{background:cb,border:'1px solid '+(hasAll?g:bd),borderRadius:'12px',padding:'24px',transition:'border-color 0.3s'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:dg,letterSpacing:'1px',marginBottom:'20px'}}>RESULTS</h2>
          <div style={{display:'flex',gap:'24px',alignItems:'flex-start'}}>
            <SyringeVisual units={hasAll ? syringeUnits : 0} />
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{background:'#0a0a0f',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',letterSpacing:'1px'}}>PEPTIDE DOSE</span>
                <span style={{fontSize:'16px',fontWeight:'700',color:hasAll?'white':mg}}>{hasAll ? activeDose+'mg ('+(activeDose!*1000)+'mcg)' : 'Select dose'}</span>
              </div>
              <div style={{background:'#0a0a0f',borderRadius:'8px',padding:'12px',border:'1px solid '+(hasAll?mg:bd)}}>
                <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',letterSpacing:'1px'}}>DRAW SYRINGE TO</span>
                <span style={{fontSize:'24px',fontWeight:'900',color:hasAll?g:mg}}>{hasAll ? syringeUnits.toFixed(1)+' units' : '—'}</span>
                {hasAll && <span style={{fontSize:'12px',color:dg,display:'block',marginTop:'2px'}}>{volumeMl.toFixed(3)} mL</span>}
              </div>
              <div style={{background:'#0a0a0f',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',letterSpacing:'1px'}}>VIAL CONTAINS</span>
                <span style={{fontSize:'14px',fontWeight:'600',color:hasAll?'white':mg}}>{hasAll ? (activeStrength!*1000)+'mcg total' : 'Select values'}</span>
              </div>
              <div style={{background:'#0a0a0f',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',letterSpacing:'1px'}}>CONCENTRATION</span>
                <span style={{fontSize:'14px',fontWeight:'600',color:hasAll?'white':mg}}>{hasAll ? concentration.toFixed(0)+'mcg/mL' : 'Select values'}</span>
              </div>
            </div>
          </div>
          <p style={{fontSize:'11px',color:mg,marginTop:'16px',lineHeight:'1.5'}}>For U-100 insulin syringes only. Reference tool. Not medical advice — verify all calculations independently.</p>
        </div>

      </div>
    </main>
  )
}