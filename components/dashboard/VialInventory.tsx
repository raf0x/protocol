'use client'
// VialInventory - tracks vials in stock and total doses taken

import { useState, useEffect } from 'react'

type Props = {
  compoundId: string
  compoundName: string
}

export default function VialInventory({ compoundId, compoundName }: Props) {
  const key = 'vial_inventory_' + compoundId
  const [count, setCount] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [dosesOverride, setDosesOverride] = useState<number | null>(null)
  const [editingDoses, setEditingDoses] = useState(false)
  const [dosesInput, setDosesInput] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null) setCount(parseInt(saved))
      const doses = localStorage.getItem(key + '_doses')
      if (doses !== null) setDosesOverride(parseInt(doses))
    } catch(e) {}
  }, [compoundId])

  function saveCount() {
    const val = parseInt(input)
    if (!isNaN(val) && val >= 0) {
      setCount(val)
      try { localStorage.setItem(key, String(val)) } catch(e) {}
    }
    setEditing(false)
  }

  function saveDoses() {
    const val = parseInt(dosesInput)
    if (!isNaN(val) && val >= 0) {
      setDosesOverride(val)
      try {
        localStorage.setItem(key + '_doses', String(val))
        window.dispatchEvent(new Event('doses_updated'))
      } catch(e) {}
    }
    setEditingDoses(false)
  }

  function decrement() {
    if (count === null || count <= 0) return
    const next = count - 1
    setCount(next)
    try { localStorage.setItem(key, String(next)) } catch(e) {}
  }

  const weeksLeft = count !== null && count > 0 ? count * 4 : null

  return (
    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)'}}>
      {/* Vials in stock */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
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
          {count !== null && count > 0 && (
            <button onClick={decrement} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>-1</button>
          )}
          {editing ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' min='0' value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveCount()} style={{width:'50px',background:'var(--color-input)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px',color:'var(--color-text)',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveCount} style={{background:'var(--color-green)',color:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setEditing(true); setInput(count !== null ? String(count) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{count === null ? 'Set' : 'Edit'}</button>
          )}
        </div>
      </div>
      {/* Doses taken override */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'8px',borderTop:'1px solid var(--color-border)'}}>
        <div>
          <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>DOSES TAKEN (TOTAL)</span>
          <span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'700'}}>{dosesOverride !== null ? dosesOverride : 'Not set'}</span>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {editingDoses ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' min='0' value={dosesInput} onChange={e => setDosesInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveDoses()} style={{width:'55px',background:'var(--color-input)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px',color:'var(--color-text)',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveDoses} style={{background:'var(--color-green)',color:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>✓</button>
            </div>
          ) : (
            <button onClick={() => { setEditingDoses(true); setDosesInput(dosesOverride !== null ? String(dosesOverride) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{dosesOverride === null ? 'Set' : 'Edit'}</button>
          )}
        </div>
      </div>
    </div>
  )
}