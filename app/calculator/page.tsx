'use client'

import { useState, useEffect } from 'react'

const DOSE_PRESETS = [0.1, 0.25, 0.5, 1, 2, 2.5, 5, 7.5, 10]
const STRENGTH_PRESETS = [1, 2, 5, 10, 15, 20, 30, 60]
const WATER_PRESETS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0]
const TARGET_UNITS = [10, 20, 25, 50]

function SyringeVisual({ units }: { units: number }) {
  const maxUnits = 100
  const fillPct = Math.min(units / maxUnits, 1)
  const bodyH = 180
  const fillH = bodyH * fillPct
  const fillY = 20 + (bodyH - fillH)
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
      <svg width='60' height='240' viewBox='0 0 60 240'>
        <polygon points='28,220 32,220 30,238' fill='#8b8ba7' />
        <rect x='16' y='20' width='28' height='200' rx='4' fill='#1a1a2e' stroke='#3d3d6e' strokeWidth='2'/>
        {fillH > 0 && <rect x='18' y={fillY} width='24' height={fillH} rx='2' fill='var(--color-green)' opacity='0.7'/>}
        {[0,25,50,75,100].map(tick => {
          const y = 20 + bodyH * (1 - tick/100)
          return <g key={tick}>
            <line x1='44' y1={y} x2='50' y2={y} stroke='#6b6b9c' strokeWidth='1'/>
            <text x='52' y={y+4} fontSize='7' fill='#6b6b9c'>{tick}</text>
          </g>
        })}
        <rect x='14' y='16' width='32' height='8' rx='2' fill='#2a2a4e' stroke='#6b6b9c' strokeWidth='1'/>
        <rect x='26' y='8' width='8' height='12' rx='2' fill='#6b6b9c'/>
      </svg>
      {units > 0 && <span style={{fontSize:'11px',color:'#8b8ba7'}}>U-100 syringe</span>}
    </div>
  )
}

function getSmartReconstitution(dose: number, strength: number): { water: number; units: number; label: string } | null {
  const candidates = TARGET_UNITS.map(targetUnits => {
    const water = (targetUnits * strength) / (dose * 100)
    return { water, units: targetUnits }
  }).filter(c => c.water >= 1.0 && c.water <= 3.0)
  if (!candidates.length) {
    // fallback: try wider range 0.5-5mL
    const fallback = TARGET_UNITS.map(targetUnits => {
      const water = (targetUnits * strength) / (dose * 100)
      return { water, units: targetUnits }
    }).filter(c => c.water >= 0.5 && c.water <= 5.0)
    if (!fallback.length) return null
    const best = fallback.sort((a,b) => Math.abs(a.water - 2.0) - Math.abs(b.water - 2.0))[0]
    return { ...best, label: 'fallback' }
  }
  // prefer higher unit values (easier to read), then closest water to 2mL
  const best = candidates.sort((a,b) => b.units - a.units || Math.abs(a.water-2.0) - Math.abs(b.water-2.0))[0]
  return { ...best, label: 'ideal' }
}

function getWarnings(dose: number | null, strength: number | null, water: number | null, units: number, smartMode: boolean): { text: string; level: 'error' | 'warn' | 'info' }[] {
  const warnings: { text: string; level: 'error' | 'warn' | 'info' }[] = []
  if (!dose || !strength || !water) return warnings
  if (dose > strength) warnings.push({ text: 'Your dose exceeds the total vial strength. Check your numbers.', level: 'error' })
  if (dose > 10) warnings.push({ text: 'Dose above 10mg is unusually high. Double-check you are not confusing mg with mcg.', level: 'error' })
  if (dose < 0.05) warnings.push({ text: 'Dose below 0.05mg is very small and hard to measure accurately.', level: 'warn' })
  if (!smartMode) {
    if (water < 0.5) warnings.push({ text: 'Less than 0.5mL BAC water creates a very concentrated solution. Ensure your vial size supports this.', level: 'warn' })
    if (water > 5) warnings.push({ text: 'More than 5mL BAC water dilutes the peptide significantly and reduces shelf stability.', level: 'warn' })
  }
  if (units > 100) warnings.push({ text: 'This draw exceeds U-100 syringe capacity (100 units). Use less BAC water to increase concentration.', level: 'error' })
  if (units > 0 && units < 2) warnings.push({ text: 'Draw volume under 2 units is too small to measure accurately. Small errors become large dose errors.', level: 'error' })
  if (units >= 2 && units < 5) warnings.push({ text: 'Draw under 5 units is difficult to measure precisely. Consider using less BAC water.', level: 'warn' })
  const concentration = (strength * 1000) / water
  if (concentration > 10000) warnings.push({ text: 'Very high concentration (' + concentration.toFixed(0) + ' mcg/mL). Verify this matches your protocol.', level: 'warn' })
  return warnings
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
  const [compoundLabel, setCompoundLabel] = useState('')
  const [smartMode, setSmartMode] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const d = params.get('dose')
    const s = params.get('vial')
    const w = params.get('water')
    const n = params.get('name')
    if (n) setCompoundLabel(decodeURIComponent(n))
    if (d) { const v = parseFloat(d); if (DOSE_PRESETS.includes(v)) setDose(v); else { setCustomDose(d); setShowCustomDose(true) } }
    if (s) { const v = parseFloat(s); if (STRENGTH_PRESETS.includes(v)) setStrength(v); else { setCustomStrength(s); setShowCustomStrength(true) } }
    if (w) { const v = parseFloat(w); if (WATER_PRESETS.includes(v)) setWater(v); else { setCustomWater(w); setShowCustomWater(true) } }
  }, [])

  const activeDose = showCustomDose ? parseFloat(customDose) : dose
  const activeStrength = showCustomStrength ? parseFloat(customStrength) : strength

  const smartRec = (smartMode && activeDose && activeStrength && !isNaN(activeDose) && !isNaN(activeStrength))
    ? getSmartReconstitution(activeDose, activeStrength)
    : null

  const activeWater = smartMode
    ? (smartRec?.water ?? null)
    : (showCustomWater ? parseFloat(customWater) : water)

  const hasAll = !!(activeDose && activeStrength && activeWater && !isNaN(activeDose) && !isNaN(activeStrength) && !isNaN(activeWater))

  let concentration = 0, volumeMl = 0, syringeUnits = 0, dosesPerVial = 0, isHighDose = false
  if (hasAll) {
    concentration = (activeStrength! * 1000) / activeWater!
    volumeMl = (activeDose! * 1000) / concentration
    syringeUnits = volumeMl * 100
    dosesPerVial = Math.floor(activeStrength! / activeDose!)
    isHighDose = activeDose! > 10
  }

  const warnings = getWarnings(activeDose ?? null, activeStrength ?? null, activeWater ?? null, syringeUnits, smartMode)

  function getShareUrl() {
    if (!hasAll) return ''
    return window.location.origin + '/calculator?dose=' + activeDose + '&vial=' + activeStrength + '&water=' + activeWater + (compoundLabel ? '&name=' + encodeURIComponent(compoundLabel) : '')
  }

  async function copyShareUrl() {
    const url = getShareUrl()
    if (url) { await navigator.clipboard.writeText(url); alert('Link copied!') }
  }

  const g = 'var(--color-green)', dg = '#8b8ba7', mg = '#3d3d5c', cb = '#12121a', bd = '#1e1e2e'

  function PresetBtn({ value, active, onClick }: { value: number; active: boolean; onClick: () => void }) {
    return (
      <button onClick={onClick} style={{padding:'7px 11px',borderRadius:'8px',border:'1px solid '+(active?g:bd),background:active?'var(--color-green-10)':cb,color:active?'var(--color-green-text)':dg,fontSize:'13px',fontWeight:active?'700':'400',cursor:'pointer'}}>
        {value}
      </button>
    )
  }

  return (
    <main style={{minHeight:'100vh',background:'var(--color-bg)',color:'var(--color-text)',padding:'24px'}}>
      <div style={{maxWidth:'520px',margin:'0 auto'}}>
        <a href='/' style={{fontSize:'13px',color:mg,textDecoration:'none',display:'block',marginBottom:'24px'}}>Back</a>
        <h1 style={{fontSize:'26px',fontWeight:'900',marginBottom:'4px',color:g,letterSpacing:'-0.5px'}}>Pep Calculator</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'20px'}}>Select your parameters below. Not medical advice.</p>

        {/* Smart / Advanced toggle */}
        <div style={{display:'flex',gap:'8px',marginBottom:'20px'}}>
          <button onClick={() => setSmartMode(true)} style={{flex:1,padding:'10px',borderRadius:'8px',border:'1px solid '+(smartMode?g:bd),background:smartMode?'var(--color-green-10)':cb,color:smartMode?g:dg,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>
            Smart Mode
          </button>
          <button onClick={() => setSmartMode(false)} style={{flex:1,padding:'10px',borderRadius:'8px',border:'1px solid '+(!smartMode?'#6c63ff':bd),background:!smartMode?'rgba(108,99,255,0.1)':cb,color:!smartMode?'#a78bfa':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>
            Advanced
          </button>
        </div>

        {smartMode && (
          <div style={{background:'var(--color-green-05)',border:'1px solid var(--color-green-20)',borderRadius:'10px',padding:'12px',marginBottom:'16px',fontSize:'12px',color:dg,lineHeight:'1.6'}}>
            Enter your desired dose and vial strength. We will automatically calculate the ideal amount of BAC water to give you a clean, easy-to-read syringe measurement.
          </div>
        )}

        {/* Inputs */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'14px'}}>

          {/* Dose */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>DOSE (mg)</span>
              <button onClick={() => setShowCustomDose(!showCustomDose)} style={{fontSize:'11px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>{showCustomDose?'Use presets':'Custom'}</button>
            </div>
            {showCustomDose
              ? <input type='number' value={customDose} onChange={e => setCustomDose(e.target.value)} placeholder='e.g. 0.3' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
              : <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{DOSE_PRESETS.map(v => <PresetBtn key={v} value={v} active={!showCustomDose && dose===v} onClick={() => { setDose(v); setShowCustomDose(false) }} />)}</div>
            }
          </div>

          <div style={{height:'1px',background:bd}} />

          {/* Vial strength */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>VIAL STRENGTH (mg)</span>
              <button onClick={() => setShowCustomStrength(!showCustomStrength)} style={{fontSize:'11px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>{showCustomStrength?'Use presets':'Custom'}</button>
            </div>
            {showCustomStrength
              ? <input type='number' value={customStrength} onChange={e => setCustomStrength(e.target.value)} placeholder='e.g. 7' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
              : <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{STRENGTH_PRESETS.map(v => <PresetBtn key={v} value={v} active={!showCustomStrength && strength===v} onClick={() => { setStrength(v); setShowCustomStrength(false) }} />)}</div>
            }
          </div>

          {/* BAC water � only shown in Advanced */}
          {!smartMode && <>
            <div style={{height:'1px',background:bd}} />
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>BAC WATER (mL)</span>
                <button onClick={() => setShowCustomWater(!showCustomWater)} style={{fontSize:'11px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>{showCustomWater?'Use presets':'Custom'}</button>
              </div>
              {showCustomWater
                ? <input type='number' value={customWater} onChange={e => setCustomWater(e.target.value)} placeholder='e.g. 1.2' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
                : <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{WATER_PRESETS.map(v => <PresetBtn key={v} value={v} active={!showCustomWater && water===v} onClick={() => { setWater(v); setShowCustomWater(false) }} />)}</div>
              }
            </div>
          </>}
        </div>

        {/* Smart recommendation card */}
        {smartMode && activeDose && activeStrength && (
          <div style={{borderRadius:'12px',padding:'16px',marginBottom:'16px',border:'1px solid var(--color-green-40)',background:'rgba(57,255,20,0.06)'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:g,letterSpacing:'1px',marginBottom:'10px'}}>SUGGESTED RECONSTITUTION</div>
            {smartRec ? (<>
              <div style={{fontSize:'22px',fontWeight:'900',color:'var(--color-text)',marginBottom:'6px'}}>
                Add <span style={{color:g}}>{smartRec.water.toFixed(1)} mL</span> BAC water
              </div>
              <div style={{fontSize:'14px',color:dg,marginBottom:'12px',lineHeight:'1.6'}}>
                Then draw to the <span style={{color:'var(--color-text)',fontWeight:'700'}}>{smartRec.units} unit</span> mark on your U-100 syringe. This equals exactly <span style={{color:'var(--color-text)',fontWeight:'700'}}>{activeDose}mg</span>.
              </div>
              <div style={{fontSize:'12px',color:mg,lineHeight:'1.5',borderTop:'1px solid var(--color-green-15)',paddingTop:'10px'}}>
                Why {smartRec.units} units? The {smartRec.units}u mark is a bold line on every U-100 syringe � easy to hit accurately. {smartRec.water.toFixed(1)}mL is a stable reconstitution volume for most peptide vials.
              </div>
            </>) : (
              <div style={{fontSize:'13px',color:'#f97316'}}>No clean syringe reading found for this combination. Switch to Advanced mode to set BAC water manually.</div>
            )}
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
            {warnings.map((w, i) => (
              <div key={i} style={{borderRadius:'8px',padding:'10px 12px',fontSize:'12px',lineHeight:'1.5',
                background:w.level==='error'?'rgba(255,107,107,0.1)':'rgba(249,115,22,0.1)',
                border:'1px solid '+(w.level==='error'?'rgba(255,107,107,0.4)':'rgba(249,115,22,0.4)'),
                color:w.level==='error'?'#ff6b6b':'#f97316'}}>
                {w.level==='error'?'\u26A0 ':'\u26A0 '}{w.text}
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        <div style={{background:cb,border:'1px solid '+(hasAll?g:bd),borderRadius:'12px',padding:'24px',transition:'border-color 0.3s'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',marginBottom:'20px'}}>RESULTS</h2>
          <div style={{display:'flex',gap:'24px',alignItems:'flex-start'}}>
            <SyringeVisual units={hasAll ? syringeUnits : 0} />
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{background:'var(--color-surface)',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>PEPTIDE DOSE</span>
                <span style={{fontSize:'16px',fontWeight:'700',color:hasAll?'white':mg}}>{hasAll ? activeDose+'mg ('+(activeDose!*1000)+'mcg)' : 'Select dose'}</span>
              </div>
              <div style={{background:'var(--color-surface)',border:'1px solid '+(hasAll?'#6c63ff':bd),borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>DRAW SYRINGE TO</span>
                <span style={{fontSize:'24px',fontWeight:'900',color:hasAll?g:mg}}>{hasAll ? syringeUnits.toFixed(1)+' units' : '\u2014'}</span>
                {hasAll && <span style={{fontSize:'12px',color:dg,display:'block',marginTop:'2px'}}>{volumeMl.toFixed(3)} mL</span>}
              </div>
              <div style={{background:'var(--color-surface)',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>BAC WATER ADDED</span>
                <span style={{fontSize:'14px',fontWeight:'600',color:hasAll?'white':mg}}>{hasAll ? activeWater!.toFixed(1)+' mL' : 'Select values'}</span>
              </div>
              <div style={{background:'var(--color-surface)',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>CONCENTRATION</span>
                <span style={{fontSize:'14px',fontWeight:'600',color:hasAll?'white':mg}}>{hasAll ? concentration.toFixed(0)+' mcg/mL' : 'Select values'}</span>
              </div>
              <div style={{background:'var(--color-surface)',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>DOSES PER VIAL</span>
                <span style={{fontSize:'14px',fontWeight:'600',color:hasAll?'white':mg}}>{hasAll ? dosesPerVial+' doses' : 'Select values'}</span>
              </div>
            </div>
          </div>
          <p style={{fontSize:'11px',color:mg,marginTop:'16px',lineHeight:'1.5'}}>For U-100 insulin syringes only. Reference tool. Not medical advice � verify all calculations independently.</p>

          {hasAll && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd}}>
              <div style={{marginBottom:'12px'}}>
                <input value={compoundLabel} onChange={e => setCompoundLabel(e.target.value)} placeholder='Compound name (optional)' style={{width:'100%',background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'var(--color-text)',fontSize:'12px',boxSizing:'border-box',marginBottom:'8px'}} />
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={copyShareUrl} style={{flex:1,background:'var(--color-bg)',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:dg,fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share</button>
                <a href='/auth/login' style={{flex:1,background:g,color:'var(--color-green-text)',textDecoration:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>Save to protocol</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
