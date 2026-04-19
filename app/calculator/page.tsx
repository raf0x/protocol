'use client'

import { useState, useEffect } from 'react'

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
        <rect x='16' y='20' width='28' height='200' rx='4' fill='#1a1a2e' stroke='#3d3d6e' strokeWidth='2'/>
        {/* Fill level */}
        {fillH > 0 && <rect x='18' y={fillY} width='24' height={fillH} rx='2' fill='#39ff14' opacity='0.7'/>}
        {/* Tick marks */}
        {[0,25,50,75,100].map(tick => {
          const y = 20 + bodyH * (1 - tick/100)
          return <g key={tick}>
            <line x1='44' y1={y} x2='50' y2={y} stroke='#6b6b9c' strokeWidth='1'/>
            <text x='52' y={y+4} fontSize='7' fill='#6b6b9c'>{tick}</text>
          </g>
        })}
        {/* Plunger */}
        <rect x='14' y='16' width='32' height='8' rx='2' fill='#2a2a4e' stroke='#6b6b9c' strokeWidth='1'/>
        <rect x='26' y='8' width='8' height='12' rx='2' fill='#6b6b9c'/>
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
  const [compoundLabel, setCompoundLabel] = useState('')
  const [showSaveFlow, setShowSaveFlow] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [savingProtocol, setSavingProtocol] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)


  useEffect(() => {
    setIsLoggedIn(true)
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

  function getShareUrl() {
    if (!hasAll) return ''
    return window.location.origin + '/calculator?dose=' + activeDose + '&vial=' + activeStrength + '&water=' + activeWater + (compoundLabel ? '&name=' + encodeURIComponent(compoundLabel) : '')
  }

  async function copyShareUrl() {
    const url = getShareUrl()
    if (url) { await navigator.clipboard.writeText(url); alert('Link copied!') }
  }

  async function saveToProtocol() {
    if (!compoundLabel.trim()) return
    setSavingProtocol(true)
    try {
      const res = await fetch('/api/create-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: compoundLabel.trim(), dose: activeDose, vial: activeStrength, water: activeWater })
      })
      const data = await res.json()
      if (data.error === 'Not authenticated') { setIsLoggedIn(false); setShowSaveFlow(true); setSavingProtocol(false); return }
      if (data.success) { setSaveSuccess(true) }
      setSavingProtocol(false)
    } catch (e) { console.error(e); setSavingProtocol(false) }
  }

  const activeDose = showCustomDose ? parseFloat(customDose) : dose
  const activeStrength = showCustomStrength ? parseFloat(customStrength) : strength
  const activeWater = showCustomWater ? parseFloat(customWater) : water

  const hasAll = activeDose && activeStrength && activeWater && !isNaN(activeDose) && !isNaN(activeStrength) && !isNaN(activeWater)

  let concentration = 0, volumeMl = 0, syringeUnits = 0, totalMcg = 0, dosesPerVial = 0, isHighDose = false, isLowDose = false
  if (hasAll) {
    totalMcg = activeStrength! * 1000
    concentration = totalMcg / activeWater!
    volumeMl = (activeDose! * 1000) / concentration
    syringeUnits = volumeMl * 100
    dosesPerVial = Math.floor(activeStrength! / activeDose!)
    isHighDose = activeDose! > 10
    isLowDose = activeDose! < 0.05
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
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'}}>DOSE OF PEPTIDE (mg)</h2>
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
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'}}>VIAL STRENGTH (mg)</h2>
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
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'}}>BACTERIOSTATIC WATER (mL)</h2>
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
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'20px'}}>RESULTS</h2>
          <div style={{display:'flex',gap:'24px',alignItems:'flex-start'}}>
            <SyringeVisual units={hasAll ? syringeUnits : 0} />
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{background:'#1a1a2e',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>PEPTIDE DOSE</span>
                <span style={{fontSize:'16px',fontWeight:'700',color:hasAll?'white':mg}}>{hasAll ? activeDose+'mg ('+(activeDose!*1000)+'mcg)' : 'Select dose'}</span>
              </div>
              <div style={{background:'#1a1a2e',border:'1px solid '+(hasAll?'#6c63ff':bd),borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>DRAW SYRINGE TO</span>
                <span style={{fontSize:'24px',fontWeight:'900',color:hasAll?g:mg}}>{hasAll ? syringeUnits.toFixed(1)+' units' : '—'}</span>
                {hasAll && <span style={{fontSize:'12px',color:dg,display:'block',marginTop:'2px'}}>{volumeMl.toFixed(3)} mL</span>}
              </div>
              <div style={{background:'#1a1a2e',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>VIAL CONTAINS</span>
                <span style={{fontSize:'14px',fontWeight:'600',color:hasAll?'white':mg}}>{hasAll ? (activeStrength!*1000)+'mcg total' : 'Select values'}</span>
              </div>
              <div style={{background:'#1a1a2e',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'}}>
                <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'}}>CONCENTRATION</span>
                <span style={{fontSize:'14px',fontWeight:'600',color:hasAll?'white':mg}}>{hasAll ? concentration.toFixed(0)+'mcg/mL' : 'Select values'}</span>
              </div>
            </div>
          </div>
          <p style={{fontSize:'11px',color:mg,marginTop:'16px',lineHeight:'1.5'}}>For U-100 insulin syringes only. Reference tool. Not medical advice — verify all calculations independently.</p>

          {hasAll && showSaveFlow && !saveSuccess && isLoggedIn && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'8px'}}>ADD TO YOUR STACK</span>
              {!compoundLabel.trim() && <input value={compoundLabel} onChange={e => setCompoundLabel(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'8px'}} />}
              {compoundLabel.trim() && <input value={compoundLabel} onChange={e => setCompoundLabel(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'8px'}} />}
              <p style={{fontSize:'11px',color:mg,marginBottom:'10px'}}>Creates: {activeDose}mg dose · {activeStrength}mg vial · {activeWater}mL BAC · Weekly</p>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => setShowSaveFlow(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                <button onClick={saveToProtocol} disabled={savingProtocol || !compoundLabel.trim()} style={{flex:2,background:savingProtocol||!compoundLabel.trim()?'#1a3d1a':g,color:savingProtocol||!compoundLabel.trim()?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{savingProtocol ? 'Creating...' : 'Create Protocol'}</button>
              </div>
            </div>
          )}

          {hasAll && showSaveFlow && !isLoggedIn && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd,textAlign:'center'}}>
              <p style={{fontSize:'13px',color:dg,marginBottom:'10px'}}>Sign in to save this to your protocol</p>
              <a href='/auth/login' style={{display:'block',background:g,color:'#000',textDecoration:'none',fontWeight:'700',padding:'12px',borderRadius:'6px',fontSize:'14px',textAlign:'center'}}>Sign in / Create account</a>
            </div>
          )}

          {saveSuccess && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd,textAlign:'center'}}>
              <span style={{color:g,fontSize:'14px',fontWeight:'700'}}>✓ Protocol created!</span>
              <p style={{fontSize:'12px',color:dg,marginTop:'6px'}}>View it on your <a href='/protocol' style={{color:g,textDecoration:'none'}}>Dashboard →</a></p>
            </div>
          )}

          {hasAll && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd}}>
              {isHighDose && (
                <div style={{background:'rgba(249,115,22,0.1)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'6px',padding:'10px',marginBottom:'12px',fontSize:'12px',color:'#f97316'}}>
                  ⚠ This dose appears unusually high. Double-check your units (mg vs mcg).
                </div>
              )}
              <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>CONFIDENCE CHECK</div>
              <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:dg}}>
                  <span style={{color:g}}>✓</span> {dosesPerVial} doses per vial at this dose
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:dg}}>
                  <span style={{color:g}}>✓</span> Concentration: {concentration.toFixed(0)} mcg/mL
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:dg}}>
                  <span style={{color:g}}>✓</span> Draw volume: {volumeMl.toFixed(3)} mL ({syringeUnits.toFixed(1)} units)
                </div>
                {syringeUnits <= 100 && syringeUnits > 0 && (
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:dg}}>
                    <span style={{color:g}}>✓</span> Within U-100 syringe range
                  </div>
                )}
                {syringeUnits > 100 && (
                  <div style={{display:'flex',alignItems:'center',gap:'8px',fontSize:'12px',color:'#f97316'}}>
                    <span>⚠</span> Exceeds U-100 syringe capacity — consider less water for higher concentration
                  </div>
                )}
              </div>
              <div style={{marginTop:'16px'}}>
                <input value={compoundLabel} onChange={e => setCompoundLabel(e.target.value)} placeholder='Compound name (optional, shown when shared)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'12px',boxSizing:'border-box',marginBottom:'8px'}} />
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={copyShareUrl} style={{flex:1,background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:dg,fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share calculation</button>
                <a href='/auth/login' style={{flex:1,background:g,color:'#000',textDecoration:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>Save to protocol →</a>
              </div>
            </div>
          )}

        </div>

      </div>
    </main>
  )
}