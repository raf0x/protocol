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
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNewVial, setShowNewVial] = useState(false)
  const [newReconDate, setNewReconDate] = useState(new Date().toISOString().split('T')[0])
  const [newBacWater, setNewBacWater] = useState(bacWaterMl ? String(bacWaterMl) : '')

  useEffect(() => {
    // Clear immediately on compound switch to prevent stale data flash
    setCount(null)
    setDosesOverride(null)
    setEditing(false)
    setEditingDoses(false)
    setLoading(true)
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('compounds')
        .select('vials_in_stock, doses_taken_override')
        .eq('id', compoundId)
        .single()
      if (data) {
        setCount(data.vials_in_stock ?? null)
        if (data.doses_taken_override !== null && data.doses_taken_override !== undefined) {
          setDosesOverride(data.doses_taken_override)
          try { localStorage.setItem('vial_inventory_' + compoundId + '_doses', String(data.doses_taken_override)) } catch(e) {}
        } else {
          setDosesOverride(null)
          try { localStorage.removeItem('vial_inventory_' + compoundId + '_doses') } catch(e) {}
        }
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

  async function handleDecrement() {
    if (count === null || count <= 0) return
    // Show new vial modal instead of just decrementing
    setNewReconDate(new Date().toISOString().split('T')[0])
    setNewBacWater(bacWaterMl ? String(bacWaterMl) : '')
    setShowNewVial(true)
  }

  async function confirmNewVial() {
    setSaving(true)
    const supabase = createClient()
    const next = (count || 1) - 1
    // Update vials in stock, reset doses, update reconstitution date and BAC water
    await supabase.from('compounds').update({
      vials_in_stock: next,
      doses_taken_override: 0,
      reconstitution_date: newReconDate,
      bac_water_ml: newBacWater ? parseFloat(newBacWater) : bacWaterMl
    }).eq('id', compoundId)
    setCount(next)
    setDosesOverride(0)
    try { localStorage.setItem('vial_inventory_' + compoundId + '_doses', '0'); window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
    setSaving(false)
    setShowNewVial(false)
  }

  const weeksLeft = count !== null && count > 0 ? count * 4 : null

  if (loading) return <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid rgba(255,255,255,0.1)',fontSize:'11px',color:'rgba(255,255,255,0.3)'}}>Loading...</div>

  return (
    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>

      {/* New Vial Modal */}
      {showNewVial && (
        <div style={{background:'rgba(0,0,0,0.85)',position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
          <div style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'380px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',marginBottom:'8px'}}>NEW VIAL</div>
            <h3 style={{fontSize:'18px',fontWeight:'800',color:'white',marginBottom:'4px'}}>{compoundName}</h3>
            <p style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginBottom:'20px'}}>Log your new vial. Doses taken will reset to 0.</p>
            <label style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>RECONSTITUTION DATE</label>
            <input type='date' value={newReconDate} onChange={e => setNewReconDate(e.target.value)} style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'12px',colorScheme:'dark'}} />
            <label style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>BAC WATER (mL)</label>
            <input type='number' step='0.5' value={newBacWater} onChange={e => setNewBacWater(e.target.value)} placeholder='e.g. 3.0' style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'20px'}} />
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setShowNewVial(false)} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'12px',color:'rgba(255,255,255,0.5)',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={confirmNewVial} disabled={saving} style={{flex:2,background:'#39ff14',color:'#000',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'800',cursor:'pointer'}}>{saving ? 'Saving...' : 'Log New Vial'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vials in stock */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
        <div>
          <span style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.3)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>VIALS IN STOCK</span>
          {count !== null ? (
            <span style={{fontSize:'13px',color:count<=1?'#ff6b6b':count<=2?'#f59e0b':'rgba(255,255,255,0.8)',fontWeight:'700'}}>
              {count} vial{count !== 1 ? 's' : ''}{weeksLeft ? ' · ~' + weeksLeft + 'wk supply' : ' — reorder soon'}
            </span>
          ) : (
            <span style={{fontSize:'12px',color:'rgba(255,255,255,0.3)'}}>Not set</span>
          )}
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {count !== null && count > 0 && (
            <button onClick={handleDecrement} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'12px',cursor:'pointer'}}>-1 vial</button>
          )}
          {editing ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' min='0' value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveCount()} style={{width:'50px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',padding:'5px',color:'white',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveCount} disabled={saving} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setEditing(true); setInput(count !== null ? String(count) : '') }} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'12px',cursor:'pointer'}}>{count === null ? 'Set' : 'Edit'}</button>
          )}
        </div>
      </div>

      {/* Doses taken override */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'8px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
        <div>
          <span style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.3)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>DOSES TAKEN (THIS VIAL)</span>
          <span style={{fontSize:'13px',color:'rgba(255,255,255,0.8)',fontWeight:'700'}}>{dosesOverride !== null ? dosesOverride : 'Not set'}</span>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {editingDoses ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' min='0' value={dosesInput} onChange={e => setDosesInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveDoses()} style={{width:'55px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',padding:'5px',color:'white',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveDoses} disabled={saving} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setEditingDoses(true); setDosesInput(dosesOverride !== null ? String(dosesOverride) : '') }} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'12px',cursor:'pointer'}}>{dosesOverride === null ? 'Set' : 'Edit'}</button>
          )}
        </div>
      </div>
    </div>
  )
}