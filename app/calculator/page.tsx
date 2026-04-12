'use client'

import { useState } from 'react'

export default function ReconstitutionCalculator() {
  const [peptideAmount, setPeptideAmount] = useState('')
  const [bacWater, setBacWater] = useState('')
  const [desiredDose, setDesiredDose] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<{concentration:number,volumeMl:number,syringeUnits:number}|null>(null)
  const g = '#39ff14'
  const dg = '#4dbd4d'
  const mg = '#2d5a2d'
  const bg = '#000000'
  const cb = '#0d0d0d'
  const bd = '#1a1a1a'
  function calculate() {
    setError(''); setResult(null)
    const peptide = parseFloat(peptideAmount)
    const water = parseFloat(bacWater)
    const dose = parseFloat(desiredDose)
    if (isNaN(peptide)||isNaN(water)||isNaN(dose)){setError('Please fill in all three fields.');return}
    if (peptide<=0||water<=0||dose<=0){setError('All values must be greater than zero.');return}
    const peptideMcg=peptide*1000
    if (dose>peptideMcg){setError('Dose exceeds vial amount.');return}
    const concentration=peptideMcg/water
    const volumeMl=dose/concentration
    const syringeUnits=volumeMl*100
    setResult({concentration,volumeMl,syringeUnits})
  }
  const inp = {flex:1,background:cb,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',outline:'none'}
  return (
    <main style={{minHeight:'100vh',background:bg,color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <a href='/' style={{fontSize:'13px',color:mg,textDecoration:'none',display:'block',marginBottom:'24px'}}>Back to home</a>
        <h1 style={{fontSize:'24px',fontWeight:'bold',marginBottom:'4px',color:g}}>Pep Calculator</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'24px'}}>Enter your vial details to find out how many units to draw. Not medical advice.</p>
        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px',fontWeight:'600'}}>Peptide vial amount</label>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <input type='number' min='0' step='any' value={peptideAmount} onChange={e=>setPeptideAmount(e.target.value)} placeholder='e.g. 5' style={inp} />
            <span style={{color:dg,fontSize:'13px',fontWeight:'600'}}>mg</span>
          </div>
        </div>
        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px',fontWeight:'600'}}>Bacteriostatic water added</label>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <input type='number' min='0' step='any' value={bacWater} onChange={e=>setBacWater(e.target.value)} placeholder='e.g. 2' style={inp} />
            <span style={{color:dg,fontSize:'13px',fontWeight:'600'}}>mL</span>
          </div>
        </div>
        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px',fontWeight:'600'}}>Desired dose</label>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            <input type='number' min='0' step='any' value={desiredDose} onChange={e=>setDesiredDose(e.target.value)} placeholder='e.g. 250' style={inp} />
            <span style={{color:dg,fontSize:'13px',fontWeight:'600'}}>mcg</span>
          </div>
        </div>
        <button onClick={calculate} style={{width:'100%',background:g,color:bg,fontWeight:'700',padding:'14px',borderRadius:'6px',border:'none',fontSize:'16px',cursor:'pointer',marginBottom:'16px'}}>Calculate</button>
        {error&&<div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'16px'}}>{error}</div>}
        {result&&(
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'20px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'16px',color:g}}>Results</h2>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px'}}><span style={{color:dg,fontSize:'13px'}}>Solution concentration</span><span style={{fontSize:'13px'}}>{result.concentration.toFixed(2)} mcg / mL</span></div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'12px'}}><span style={{color:dg,fontSize:'13px'}}>Volume to draw</span><span style={{fontSize:'13px'}}>{result.volumeMl.toFixed(3)} mL</span></div>
            <div style={{display:'flex',justifyContent:'space-between',paddingTop:'12px',borderTop:'1px solid '+bd}}><span style={{fontSize:'14px',fontWeight:'500'}}>Draw to this line</span><span style={{fontSize:'24px',fontWeight:'bold',color:g}}>{result.syringeUnits.toFixed(1)} units</span></div>
            <p style={{fontSize:'11px',color:mg,marginTop:'12px'}}>U-100 syringe. Reference only. Not medical advice.</p>
          </div>
        )}
      </div>
    </main>
  )
}