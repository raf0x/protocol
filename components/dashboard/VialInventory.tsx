'use client'
// VialInventory � tracks how many vials remain per compound

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null) setCount(parseInt(saved))
    } catch(e) {}
  }, [compoundId])

  function save() {
    const val = parseInt(input)
    if (!isNaN(val) && val >= 0) {
      setCount(val)
      try { localStorage.setItem(key, String(val)) } catch(e) {}
    }
    setEditing(false)
  }

  function decrement() {
    if (count === null || count <= 0) return
    const next = count - 1
    setCount(next)
    try { localStorage.setItem(key, String(next)) } catch(e) {}
  }

  const weeksLeft = count !== null && count > 0 ? count * 4 : null

  return (
    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
      <div>
        <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>VIALS IN STOCK</span>
        {count !== null ? (
          <span style={{fontSize:'13px',color:count<=1?'#ff6b6b':count<=2?'#f59e0b':'var(--color-text)',fontWeight:'700'}}>
            {count} vial{count !== 1 ? 's' : ''}{weeksLeft ? ' · ~'+weeksLeft+'wk supply' : ' — reorder soon'}
          </span>
        ) : (
          <span style={{fontSize:'12px',color:'var(--color-muted)'}}>Not set</span>
        )}
      </div>
      <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
        {count !== null && count > 0 && (
          <button onClick={decrement} title='Used a vial' style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>-1</button>
        )}
        {editing ? (
          <div style={{display:'flex',gap:'4px'}}>
            <input type='number' min='0' value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==='Enter' && save()} style={{width:'50px',background:'var(--color-input)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px',color:'var(--color-text)',fontSize:'12px',textAlign:'center'}} autoFocus />
            <button onClick={save} style={{background:'var(--color-green)',color:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>&#10003;</button>
          </div>
        ) : (
          <button onClick={() => { setEditing(true); setInput(count !== null ? String(count) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{count === null ? 'Set' : 'Edit'}</button>
        )}
      </div>
    </div>
  )
}
