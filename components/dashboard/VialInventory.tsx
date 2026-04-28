'use client'
import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

type Props = {
  compoundId: string
  compoundName: string
}

export default function VialInventory({ compoundId, compoundName }: Props) {
  const [count, setCount] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [dosesOverride, setDosesOverride] = useState<number | null>(null)
  const [editingDoses, setEditingDoses] = useState(false)
  const [dosesInput, setDosesInput] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('compounds')
        .select('vials_in_stock, doses_taken_override')
        .eq('id', compoundId)
        .single()
      if (data) {
        if (data.vials_in_stock !== null) setCount(data.vials_in_stock)
        if (data.doses_taken_override !== null) {
          setDosesOverride(data.doses_taken_override)
          // Also sync to localStorage for hero card
          try { localStorage.setItem('vial_inventory_' + compoundId + '_doses', String(data.doses_taken_override)) } catch(e) {}
        }
      }
    }
    load()
  }, [compoundId])

  async function saveCount() {
    const val = parseInt(input)
    if (!isNaN(val) && val >= 0) {
      setCount(val)
      setSaving(true)
      const supabase = createClient()
      await supabase.from('compounds').update({ vials_in_stock: val }).eq('id', compoundId)
      setSaving(false)
    }
    setEditing(false)
  }

  async function saveDoses() {
    const val = parseInt(dosesInput)
    if (!isNaN(val) && val >= 0) {
      setDosesOverride(val)
      setSaving(true)
      const supabase = createClient()
      await supabase.from('compounds').update({ doses_taken_override: val }).eq('id', compoundId)
      setSaving(false)
      // Sync to localStorage for hero card reactivity
      try {
        localStorage.setItem('vial_inventory_' + compoundId + '_doses', String(val))
        window.dispatchEvent(new Event('doses_updated'))
      } catch(e) {}
    }
    setEditingDoses(false)
  }

  async function decrement() {
    if (count === null || count <= 0) return
    const next = count - 1
    setCount(next)
    const supabase = createClient()
    await supabase.from('compounds').update({ vials_in_stock: next }).eq('id', compoundId)
  }

  const weeksLeft = count !== null && count > 0 ? count * 4 : null

  return (
    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid rgba(255,255,255,0.1)'}}>
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
            <button onClick={decrement} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'12px',cursor:'pointer'}}>-1</button>
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
          <span style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.3)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>DOSES TAKEN (TOTAL)</span>
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