const fs = require('fs');
const content = `'use client'

import { useState } from 'react'

export default function ReconstitutionCalculator() {
  const [peptideAmount, setPeptideAmount] = useState('')
  const [bacWater, setBacWater] = useState('')
  const [desiredDose, setDesiredDose] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  function calculate() {
    setError('')
    setResult(null)
    const peptide = parseFloat(peptideAmount)
    const water = parseFloat(bacWater)
    const dose = parseFloat(desiredDose)
    if (isNaN(peptide) || isNaN(water) || isNaN(dose)) { setError('Please fill in all three fields with numbers.'); return }
    if (peptide <= 0 || water <= 0 || dose <= 0) { setError('All values must be greater than zero.'); return }
    const peptideMcg = peptide * 1000
    if (dose > peptideMcg) { setError('Desired dose exceeds total peptide in vial. Check your numbers.'); return }
    const concentration = peptideMcg / water
    const volumeMl = dose / concentration
    const syringeUnits = volumeMl * 100
    setResult({ concentration, volumeMl, syringeUnits })
  }

  return (
    <main style={{minHeight:'100vh',background:'#000000',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <a href="/" style={{fontSize:'13px',color:'#2d5a2d',textDecoration:'none',display:'block',marginBottom:'24px'}}>Back to home</a>
        <h1 style={{fontSize:'24px',fontWeight:'bold',marginBottom:'4px',color:'#39ff14'}}>Pep Calculator</h1>
        <p style={{color:'#4dbd4d',fontSize:'13px',marginBottom:'24px'}}>Enter your vial details to find out how many units to draw. Not medical advice.</p>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'13px',color:'#4dbd4d',marginBottom:'4px',fontWeight:'600'}}>Peptide vial amount</label>
          <p style={{fontSize:'11px',color:'#2d5a2d',marginBottom:'6px'}}>The amount printed on your vial.</p>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <input type="number" min="0" step="any" value={peptideAmount} onChange={e => setPeptideAmount(e.target.value)} placeholder="e.g. 5" style={{flex:1,background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',outline:'none'}} />
            <span style={{color:'#4dbd4d',fontSize:'13px',fontWeight:'600'}}>mg</span>
          </div>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'13px',color:'#4dbd4d',marginBottom:'4px',fontWeight:'600'}}>Bacteriostatic water added</label>
          <p style={{fontSize:'11px',color:'#2d5a2d',marginBottom:'6px'}}>How much BAC water you injected into the vial.</p>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <input type="number" min="0" step="any" value={bacWater} onChange={e => setBacWater(e.target.value)} placeholder="e.g. 2" style={{flex:1,background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',outline:'none'}} />
            <span style={{color:'#4dbd4d',fontSize:'13px',fontWeight:'600'}}>mL</span>
          </div>
        </div>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'13px',color:'#4dbd4d',marginBottom:'4px',fontWeight:'600'}}>Desired dose</label>
          <p style={{fontSize:'11px',color:'#2d5a2d',marginBottom:'6px'}}>Note: 1 mg = 1,000 mcg.</p>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <input type="number" min="0" step="any" value={desiredDose} onChange={e => setDesiredDose(e.target.value)} placeholder="e.g. 250" style={{flex:1,background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',outline:'none'}} />
            <span style={{color:'#4dbd4d',fontSize:'13px',fontWeight:'600'}}>mcg</span>
          </div>
        </div>

        <button onClick={calculate} style={{width:'100%',background:'#39ff14',color:'#000000',fontWeight:'700',padding:'14px',borderRadius:'6px',border:'none',fontSize:'16px',cursor:'pointer',marginBottom:'16px',letterSpacing:'1px'}}>
          Calculate
        </button>

        {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'16px'}}>{error}</div>}

        {result && (
          <div style={{background:'#0d0d0d',border:'1px solid #1a1a1a',borderRadius:'8px',padding:'20px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'16px',color:'#39ff14'}}>Results</h2>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}>
              <span style={{color:'#4dbd4d',fontSize:'13px'}}>Solution concentration</span>
              <span style={{fontSize:'13px'}}>{result.concentration.toFixed(2)} mcg / mL</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}>
              <span style={{color:'#4dbd4d',fontSize:'13px'}}>Volume to draw</span>
              <span style={{fontSize:'13px'}}>{result.volumeMl.toFixed(3)} mL</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:'12px',borderTop:'1px solid #1a1a1a'}}>
              <span style={{fontSize:'14px',fontWeight:'500'}}>Draw to this line</span>
              <span style={{fontSize:'24px',fontWeight:'bold',color:'#39ff14'}}>{result.syringeUnits.toFixed(1)} units</span>
            </div>
            <p style={{fontSize:'11px',color:'#2d5a2d',marginTop:'12px'}}>U-100 insulin syringe. Reference tool only. Not medical advice.</p>
          </div>
        )}
      </div>
    </main>
  )
}`;
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
