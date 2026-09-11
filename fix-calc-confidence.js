const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// 1. Add useEffect and useSearchParams for shareable URLs
content = content.replace(
  "import { useState } from 'react'",
  "import { useState, useEffect } from 'react'\nimport { useSearchParams } from 'next/navigation'"
);

// Add search params reading after state declarations
content = content.replace(
  "  const [showCustomWater, setShowCustomWater] = useState(false)",
  `  const [showCustomWater, setShowCustomWater] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    const d = searchParams.get('dose')
    const s = searchParams.get('vial')
    const w = searchParams.get('water')
    if (d) { const v = parseFloat(d); if (DOSE_PRESETS.includes(v)) setDose(v); else { setCustomDose(d); setShowCustomDose(true) } }
    if (s) { const v = parseFloat(s); if (STRENGTH_PRESETS.includes(v)) setStrength(v); else { setCustomStrength(s); setShowCustomStrength(true) } }
    if (w) { const v = parseFloat(w); if (WATER_PRESETS.includes(v)) setWater(v); else { setCustomWater(w); setShowCustomWater(true) } }
  }, [])

  function getShareUrl() {
    if (!hasAll) return ''
    return window.location.origin + '/calculator?dose=' + activeDose + '&vial=' + activeStrength + '&water=' + activeWater
  }

  async function copyShareUrl() {
    const url = getShareUrl()
    if (url) { await navigator.clipboard.writeText(url); alert('Link copied!') }
  }`
);

// 2. Compute confidence data after syringe units
content = content.replace(
  "  let concentration = 0, volumeMl = 0, syringeUnits = 0, totalMcg = 0",
  "  let concentration = 0, volumeMl = 0, syringeUnits = 0, totalMcg = 0, dosesPerVial = 0, isHighDose = false, isLowDose = false"
);

content = content.replace(
  "    syringeUnits = volumeMl * 100\n  }",
  "    syringeUnits = volumeMl * 100\n    dosesPerVial = Math.floor(activeStrength! / activeDose!)\n    isHighDose = activeDose! > 10\n    isLowDose = activeDose! < 0.05\n  }"
);

// 3. Add confidence block, share button, and save CTA after the disclaimer
content = content.replace(
  "          <p style={{fontSize:'11px',color:mg,marginTop:'16px',lineHeight:'1.5'}}>For U-100 insulin syringes only. Reference tool. Not medical advice — verify all calculations independently.</p>",
  `          <p style={{fontSize:'11px',color:mg,marginTop:'16px',lineHeight:'1.5'}}>For U-100 insulin syringes only. Reference tool. Not medical advice — verify all calculations independently.</p>

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
              <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>
                <button onClick={copyShareUrl} style={{flex:1,background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:dg,fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share calculation</button>
                <a href='/auth/login' style={{flex:1,background:g,color:'#000',textDecoration:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>Save to protocol →</a>
              </div>
            </div>
          )}`
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
