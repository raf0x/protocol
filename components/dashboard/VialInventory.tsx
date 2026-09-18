'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type Props = {
  compoundId: string
  compoundName: string
  reconstitutionDate?: string
  bacWaterMl?: number
  vialStrength?: number
  vialUnit?: string
}

export default function VialInventory({ compoundId, compoundName, reconstitutionDate, bacWaterMl, vialStrength, vialUnit }: Props) {
  const [count, setCount] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewVial, setShowNewVial] = useState(false)
  const [newReconDate, setNewReconDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [newBacWater, setNewBacWater] = useState(bacWaterMl ? String(bacWaterMl) : '')
  const [newVialStrength, setNewVialStrength] = useState(vialStrength ? String(vialStrength) : '')

  useEffect(() => {
    setCount(null)
    setLoading(true)
    loadInventory()
  }, [compoundId])

  useEffect(() => {
    function onDosesUpdated() { loadInventory(true) }
    window.addEventListener('doses_updated', onDosesUpdated)
    return () => window.removeEventListener('doses_updated', onDosesUpdated)
  }, [compoundId])

  async function loadInventory(silent = false) {
    if (!silent) setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('compounds')
      .select('vials_in_stock')
      .eq('id', compoundId)
      .single()
    if (data) setCount(data.vials_in_stock ?? null)
    setLoading(false)
  }

  async function handleNewVial() {
    setNewReconDate(new Date().toLocaleDateString('en-CA'))
    setNewBacWater(bacWaterMl ? String(bacWaterMl) : '')
    setNewVialStrength(vialStrength ? String(vialStrength) : '')
    setShowNewVial(true)
  }

  async function confirmNewVial() {
    if (Number(newBacWater) !== Number(bacWaterMl) || Number(newVialStrength) !== Number(vialStrength)) { window.location.href = `/protocol/manage?compound=${compoundId}&reconstitution_vial=${encodeURIComponent(newVialStrength)}&reconstitution_water=${encodeURIComponent(newBacWater)}&reconstitution_date=${encodeURIComponent(newReconDate)}`; return }
    setSaving(true)
    const supabase = createClient()
    const next = Math.max(0, (count || 1) - 1)
    const parsedStrength = newVialStrength ? parseFloat(newVialStrength) : vialStrength
    await supabase.from('compounds').update({
      vials_in_stock: next,
      doses_taken_override: 0,
      reconstitution_date: newReconDate,
      bac_water_ml: newBacWater ? parseFloat(newBacWater) : bacWaterMl,
      vial_strength: parsedStrength
    }).eq('id', compoundId)
    setCount(next)
    try { window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
    setSaving(false); setShowNewVial(false)
  }

  const daysElapsed = reconstitutionDate
    ? Math.floor((Date.now() - new Date(reconstitutionDate + 'T00:00:00').getTime()) / 86400000)
    : null
  const expiryDays = 28
  const daysLeft = daysElapsed !== null ? Math.max(0, expiryDays - daysElapsed) : null
  const progress = daysElapsed !== null ? Math.min(100, (daysElapsed / expiryDays) * 100) : 0
  const barColor = progress < 50 ? '#22c55e' : progress < 80 ? '#f59e0b' : '#ef4444'
  const strengthChanged = newVialStrength && vialStrength && parseFloat(newVialStrength) !== vialStrength

  if (loading) return <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)',fontSize:'11px',color:'var(--color-muted)'}}>Loading...</div>

  return (
    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)'}}>

      {showNewVial && (
        <div style={{background:'rgba(0,0,0,0.85)',position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
          <div style={{background:'#1a1a2e',border:'1px solid var(--color-border)',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'380px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'2px',marginBottom:'8px'}}>NEW VIAL</div>
            <h3 style={{fontSize:'18px',fontWeight:'800',color:'var(--color-text)',marginBottom:'4px'}}>Starting a new {compoundName} vial?</h3>
            <p style={{fontSize:'12px',color:'var(--color-dim)',marginBottom:'20px'}}>Your previous vial will be marked as finished. Doses taken will reset to 0.</p>

            <label style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>VIAL STRENGTH ({vialUnit || 'mg'})</label>
            <input type='number' step='any' value={newVialStrength} onChange={e => setNewVialStrength(e.target.value)} placeholder='e.g. 10' style={{width:'100%',background:'var(--color-surface)',border:'1px solid '+(strengthChanged ? '#f59e0b' : 'var(--color-border)'),borderRadius:'8px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'4px'}} />
            {strengthChanged && (
              <div style={{fontSize:'11px',color:'#f59e0b',marginBottom:'12px',lineHeight:'1.4'}}>
                ⚠ Changed from {vialStrength}{vialUnit || 'mg'}. Your mL-per-dose may need updating too.
              </div>
            )}
            {!strengthChanged && <div style={{marginBottom:'12px'}} />}

            <label style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>RECONSTITUTION DATE</label>
            <input type='date' value={newReconDate} onChange={e => setNewReconDate(e.target.value)} style={{width:'100%',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'12px',colorScheme:'dark'}} />
            <label style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>BAC WATER (mL)</label>
            <input type='number' step='0.5' value={newBacWater} onChange={e => setNewBacWater(e.target.value)} placeholder='e.g. 3.0' style={{width:'100%',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'20px'}} />
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setShowNewVial(false)} style={{flex:1,background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'12px',color:'var(--color-dim)',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={confirmNewVial} disabled={saving} style={{flex:2,background:'#39ff14',color:'#000',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'800',cursor:'pointer'}}>{saving ? 'Saving...' : 'Log New Vial'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vial lifecycle: label, day badge, and the new-vial trigger on one row; bar underneath */}
      {reconstitutionDate && daysElapsed !== null && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',gap:'8px',flexWrap:'wrap'}}>
            <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'1px'}}>VIAL LIFECYCLE</span>
            <span style={{fontSize:'13px',fontWeight:'700',color:barColor}}>
              Day {daysElapsed}/{expiryDays}
              {daysLeft !== null && daysLeft > 0 && <span style={{fontSize:'11px',fontWeight:'600',color:'var(--color-dim)',marginLeft:'6px'}}>({daysLeft}d left)</span>}
              {daysLeft === 0 && <span style={{fontSize:'11px',fontWeight:'700',color:'#ef4444',marginLeft:'6px'}}>(EXPIRED)</span>}
            </span>
            <button onClick={handleNewVial} style={{background:'var(--color-green-10)',border:'1px solid var(--color-green-30)',borderRadius:'6px',padding:'5px 10px',color:'#39ff14',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>+ New Vial</button>
          </div>
          <div style={{width:'100%',height:'6px',background:'var(--color-surface)',borderRadius:'3px',overflow:'hidden',border:'1px solid var(--color-border)'}}>
            <div style={{width:`${progress}%`,height:'100%',background:barColor,transition:'width 0.3s ease, background 0.3s ease'}} />
          </div>
        </div>
      )}
    </div>
  )
}
