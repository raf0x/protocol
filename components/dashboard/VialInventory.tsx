'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type Props = {
  compoundId: string
  compoundName: string
  reconstitutionDate?: string
  bacWaterMl?: number
}

export default function VialInventory({ compoundId, compoundName, reconstitutionDate, bacWaterMl }: Props) {
  const [count, setCount] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [dosesOverride, setDosesOverride] = useState<number | null>(null)
  const [editingDoses, setEditingDoses] = useState(false)
  const [dosesInput, setDosesInput] = useState('')
  const [mlPerDose, setMlPerDose] = useState<number | null>(null)
  const [editingMl, setEditingMl] = useState(false)
  const [mlInput, setMlInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewVial, setShowNewVial] = useState(false)
  const [showMlWizard, setShowMlWizard] = useState(false)
  const [wizardMethod, setWizardMethod] = useState<'units'|'mg'|'iu'|null>(null)
  const [wizardDose, setWizardDose] = useState('')
  const [wizardVialStrength, setWizardVialStrength] = useState('')
  const [wizardBacWater, setWizardBacWater] = useState(bacWaterMl ? String(bacWaterMl) : '')
  const [newReconDate, setNewReconDate] = useState(new Date().toISOString().split('T')[0])
  const [newBacWater, setNewBacWater] = useState(bacWaterMl ? String(bacWaterMl) : '')

  useEffect(() => {
    setCount(null); setDosesOverride(null); setMlPerDose(null)
    setEditing(false); setEditingDoses(false); setEditingMl(false)
    setLoading(true)
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('compounds')
        .select('vials_in_stock, doses_taken_override, ml_per_dose')
        .eq('id', compoundId)
        .single()
      if (data) {
        setCount(data.vials_in_stock ?? null)
        setDosesOverride(data.doses_taken_override ?? null)
        setMlPerDose(data.ml_per_dose ?? null)
        // Sync to localStorage for hero card
        try {
          if (data.doses_taken_override !== null) localStorage.setItem('vial_inventory_' + compoundId + '_doses', String(data.doses_taken_override))
          if (data.ml_per_dose !== null) localStorage.setItem('vial_inventory_' + compoundId + '_ml', String(data.ml_per_dose))
          window.dispatchEvent(new Event('doses_updated'))
        } catch(e) {}
      }
      setLoading(false)
    }
    load()
  }, [compoundId])

  async function saveCount() {
    const val = parseInt(input)
    if (!isNaN(val) && val >= 0) {
      setCount(val); setSaving(true)
      const supabase = createClient()
      await supabase.from('compounds').update({ vials_in_stock: val }).eq('id', compoundId)
      setSaving(false)
    }
    setEditing(false)
  }

  async function saveDoses() {
    const val = parseInt(dosesInput)
    if (!isNaN(val) && val >= 0) {
      setDosesOverride(val); setSaving(true)
      const supabase = createClient()
      await supabase.from('compounds').update({ doses_taken_override: val }).eq('id', compoundId)
      setSaving(false)
      try { localStorage.setItem('vial_inventory_' + compoundId + '_doses', String(val)); window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
    }
    setEditingDoses(false)
  }

  function calcMlFromWizard(): number | null {
    const dose = parseFloat(wizardDose)
    const vs = parseFloat(wizardVialStrength)
    const bac = parseFloat(wizardBacWater)
    if (isNaN(dose) || dose <= 0) return null
    if (wizardMethod === 'units') return dose / 100
    if (wizardMethod === 'mg' && vs > 0 && bac > 0) return (dose * bac) / vs
    if (wizardMethod === 'iu' && vs > 0 && bac > 0) return dose / (vs / bac)
    return null
  }

  async function saveMlFromWizard() {
    const val = calcMlFromWizard()
    if (val === null || val <= 0) return
    setMlPerDose(val); setSaving(true)
    const supabase = createClient()
    await supabase.from('compounds').update({ ml_per_dose: parseFloat(val.toFixed(4)) }).eq('id', compoundId)
    setSaving(false)
    try { localStorage.setItem('vial_inventory_' + compoundId + '_ml', String(val)); window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
    setShowMlWizard(false); setWizardMethod(null); setWizardDose('')
  }

  async function saveMl() {
    const val = parseFloat(mlInput)
    if (!isNaN(val) && val > 0) {
      setMlPerDose(val); setSaving(true)
      const supabase = createClient()
      await supabase.from('compounds').update({ ml_per_dose: val }).eq('id', compoundId)
      setSaving(false)
      try { localStorage.setItem('vial_inventory_' + compoundId + '_ml', String(val)); window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
    }
    setEditingMl(false)
  }

  async function handleNewVial() {
    setNewReconDate(new Date().toISOString().split('T')[0])
    setNewBacWater(bacWaterMl ? String(bacWaterMl) : '')
    setShowNewVial(true)
  }

  async function confirmNewVial() {
    setSaving(true)
    const supabase = createClient()
    const next = Math.max(0, (count || 1) - 1)
    await supabase.from('compounds').update({
      vials_in_stock: next,
      doses_taken_override: 0,
      reconstitution_date: newReconDate,
      bac_water_ml: newBacWater ? parseFloat(newBacWater) : bacWaterMl
    }).eq('id', compoundId)
    setCount(next); setDosesOverride(0)
    try { localStorage.setItem('vial_inventory_' + compoundId + '_doses', '0'); window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
    setSaving(false); setShowNewVial(false)
  }

  const weeksLeft = count !== null && count > 0 ? count * 4 : null

  if (loading) return <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)',fontSize:'11px',color:'var(--color-muted)'}}>Loading...</div>

  return (
    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)'}}>

      {showMlWizard && (
        <div style={{background:'rgba(0,0,0,0.85)',position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
          <div style={{background:'#1a1a2e',border:'1px solid var(--color-border)',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'380px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'2px',marginBottom:'8px'}}>DOSE CALCULATOR</div>
            <h3 style={{fontSize:'18px',fontWeight:'800',color:'var(--color-text)',marginBottom:'4px'}}>{compoundName}</h3>
            <p style={{fontSize:'12px',color:'var(--color-dim)',marginBottom:'20px'}}>How do you measure your dose?</p>

            {!wizardMethod && (
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <button onClick={() => setWizardMethod('units')} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'10px',padding:'14px',color:'var(--color-text)',fontSize:'14px',fontWeight:'600',cursor:'pointer',textAlign:'left'}}>
                  <div style={{fontWeight:'700',marginBottom:'2px'}}>Syringe units</div>
                  <div style={{fontSize:'12px',color:'var(--color-dim)'}}>The numbers printed on my needle (10, 20, 50...)</div>
                </button>
                <button onClick={() => setWizardMethod('mg')} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'10px',padding:'14px',color:'var(--color-text)',fontSize:'14px',fontWeight:'600',cursor:'pointer',textAlign:'left'}}>
                  <div style={{fontWeight:'700',marginBottom:'2px'}}>Milligrams (mg)</div>
                  <div style={{fontSize:'12px',color:'var(--color-dim)'}}>My dose is written as 0.5mg, 1mg, 2mg...</div>
                </button>
                <button onClick={() => setWizardMethod('iu')} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'10px',padding:'14px',color:'var(--color-text)',fontSize:'14px',fontWeight:'600',cursor:'pointer',textAlign:'left'}}>
                  <div style={{fontWeight:'700',marginBottom:'2px'}}>International Units (IU)</div>
                  <div style={{fontSize:'12px',color:'var(--color-dim)'}}>My dose is written as 250 IU, 500 IU... (common for HCG)</div>
                </button>
              </div>
            )}

            {wizardMethod && (() => {
              const ml = calcMlFromWizard()
              const needsVial = wizardMethod === 'mg' || wizardMethod === 'iu'
              return (
                <div>
                  <button onClick={() => setWizardMethod(null)} style={{background:'none',border:'none',color:'var(--color-dim)',cursor:'pointer',fontSize:'12px',padding:0,marginBottom:'16px'}}>← Back</button>
                  <label style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>
                    {wizardMethod === 'units' ? 'HOW MANY UNITS DO YOU DRAW?' : wizardMethod === 'mg' ? 'WHAT IS YOUR DOSE IN mg?' : 'WHAT IS YOUR DOSE IN IU?'}
                  </label>
                  <input type='number' step='any' value={wizardDose} onChange={e => setWizardDose(e.target.value)} placeholder={wizardMethod === 'units' ? 'e.g. 60' : wizardMethod === 'mg' ? 'e.g. 2' : 'e.g. 500'} style={{width:'100%',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'12px',color:'var(--color-text)',fontSize:'16px',boxSizing:'border-box',marginBottom:'12px'}} autoFocus />
                  {needsVial && (
                    <>
                      <label style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>VIAL STRENGTH ({wizardMethod === 'mg' ? 'mg' : 'IU'})</label>
                      <input type='number' step='any' value={wizardVialStrength} onChange={e => setWizardVialStrength(e.target.value)} placeholder={wizardMethod === 'mg' ? 'e.g. 10' : 'e.g. 10000'} style={{width:'100%',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'12px',color:'var(--color-text)',fontSize:'16px',boxSizing:'border-box',marginBottom:'12px'}} />
                      <label style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>BAC WATER ADDED (mL)</label>
                      <input type='number' step='any' value={wizardBacWater} onChange={e => setWizardBacWater(e.target.value)} placeholder='e.g. 3' style={{width:'100%',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'12px',color:'var(--color-text)',fontSize:'16px',boxSizing:'border-box',marginBottom:'12px'}} />
                    </>
                  )}
                  {ml !== null && (
                    <div style={{background:'rgba(57,255,20,0.08)',border:'1px solid var(--color-green-30)',borderRadius:'10px',padding:'14px',marginBottom:'16px',textAlign:'center'}}>
                      <div style={{fontSize:'11px',color:'rgba(57,255,20,0.7)',fontWeight:'600',letterSpacing:'1px',marginBottom:'4px'}}>YOUR DOSE EQUALS</div>
                      <div style={{fontSize:'28px',fontWeight:'900',color:'#39ff14'}}>{ml.toFixed(2)} mL</div>
                      <div style={{fontSize:'12px',color:'var(--color-dim)',marginTop:'4px'}}>This will be saved for accurate vial tracking</div>
                    </div>
                  )}
                  <div style={{display:'flex',gap:'8px'}}>
                    <button onClick={() => setShowMlWizard(false)} style={{flex:1,background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'12px',color:'var(--color-dim)',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
                    <button onClick={saveMlFromWizard} disabled={ml === null || saving} style={{flex:2,background:ml !== null ? '#39ff14' : 'rgba(255,255,255,0.1)',color:ml !== null ? '#000' : 'rgba(255,255,255,0.3)',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'800',cursor:ml !== null ? 'pointer' : 'default'}}>{saving ? 'Saving...' : 'Save ' + (ml !== null ? ml.toFixed(2) + ' mL' : '')}</button>
                  </div>
                </div>
              )
            })()}

            {!wizardMethod && <button onClick={() => setShowMlWizard(false)} style={{width:'100%',background:'none',border:'none',color:'var(--color-muted)',cursor:'pointer',fontSize:'13px',marginTop:'16px'}}>Cancel</button>}
          </div>
        </div>
      )}

      {showNewVial && (
        <div style={{background:'rgba(0,0,0,0.85)',position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
          <div style={{background:'#1a1a2e',border:'1px solid var(--color-border)',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'380px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'2px',marginBottom:'8px'}}>NEW VIAL</div>
            <h3 style={{fontSize:'18px',fontWeight:'800',color:'var(--color-text)',marginBottom:'4px'}}>Starting a new {compoundName} vial?</h3>
            <p style={{fontSize:'12px',color:'var(--color-dim)',marginBottom:'20px'}}>Your previous vial will be marked as finished. Doses taken will reset to 0.</p>
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

      {/* mL per dose */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <div>
          <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>mL PER DOSE</span>
          {mlPerDose !== null ? (
            <span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'700'}}>{mlPerDose} mL</span>
          ) : (
            <span style={{fontSize:'12px',color:'#f97316'}}>Set this for accurate vial tracking</span>
          )}
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {editingMl ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' step='0.01' value={mlInput} onChange={e => setMlInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveMl()} placeholder='e.g. 0.15' style={{width:'65px',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px',color:'var(--color-text)',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveMl} disabled={saving} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setShowMlWizard(true); setWizardMethod(null); setWizardDose(''); setWizardBacWater(bacWaterMl ? String(bacWaterMl) : '') }} style={{background: mlPerDose === null ? 'rgba(249,115,22,0.15)' : 'var(--color-surface)',border:'1px solid '+(mlPerDose === null ? 'rgba(249,115,22,0.4)' : 'var(--color-border)'),borderRadius:'6px',padding:'5px 10px',color: mlPerDose === null ? '#f97316' : 'var(--color-dim)',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>{mlPerDose === null ? 'Set now' : 'Edit'}</button>
          )}
        </div>
      </div>

      {/* Vials in stock */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px',paddingTop:'8px',borderTop:'1px solid var(--color-border)'}}>
        <div>
          <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>VIALS IN STOCK</span>
          {count !== null ? (
            <span style={{fontSize:'13px',color:count<=1?'#ff6b6b':count<=2?'#f59e0b':'var(--color-text)',fontWeight:'700'}}>
              {count} vial{count !== 1 ? 's' : ''}{weeksLeft ? ' · ~' + weeksLeft + 'wk supply' : ' — reorder soon'}
            </span>
          ) : (
            <span style={{fontSize:'12px',color:'var(--color-muted)'}}>Not set</span>
          )}
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          <button onClick={handleNewVial} style={{background:'var(--color-green-10)',border:'1px solid var(--color-green-30)',borderRadius:'6px',padding:'5px 10px',color:'#39ff14',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>+ New Vial</button>
          {editing ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' min='0' value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveCount()} style={{width:'50px',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px',color:'var(--color-text)',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveCount} disabled={saving} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setEditing(true); setInput(count !== null ? String(count) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{count === null ? 'Set' : 'Edit'}</button>
          )}
        </div>
      </div>

      {/* Doses taken */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'8px',borderTop:'1px solid var(--color-border)'}}>
        <div>
          <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>DOSES TAKEN (THIS VIAL)</span>
          <span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'700'}}>{dosesOverride !== null ? dosesOverride : 'Not set'}</span>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {editingDoses ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' min='0' value={dosesInput} onChange={e => setDosesInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveDoses()} style={{width:'55px',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px',color:'var(--color-text)',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveDoses} disabled={saving} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setEditingDoses(true); setDosesInput(dosesOverride !== null ? String(dosesOverride) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{dosesOverride === null ? 'Set' : 'Edit'}</button>
          )}
        </div>
      </div>
    </div>
  )
}