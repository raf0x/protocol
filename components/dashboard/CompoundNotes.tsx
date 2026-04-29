'use client'
// CompoundNotes � per-compound notes field, saves to compounds.notes in Supabase

import { useState } from 'react'
import { createClient } from '../../lib/supabase'

type Props = {
  compoundId: string
  initialNotes: string
}

export default function CompoundNotes({ compoundId, initialNotes }: Props) {
  const [notes, setNotes] = useState(initialNotes || '')
  const [editing, setEditing] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from('compounds').update({ notes: notes.trim() }).eq('id', compoundId)
    setSaving(false)
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--color-border)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom: collapsed ? '0' : '6px',cursor:'pointer'}} onClick={() => !editing && setCollapsed(!collapsed)}>
        <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'1px'}}>COMPOUND NOTES</span>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            {saved && <span style={{fontSize:'11px',color:'var(--color-green)'}}>&#10003; saved</span>}
            {!editing && <button onClick={e => {e.stopPropagation();setEditing(true);setCollapsed(false)}} style={{background:'none',border:'none',color:'var(--color-dim)',cursor:'pointer',fontSize:'12px',padding:0}}>{notes ? 'Edit' : '+ Add note'}</button>}
            <span style={{fontSize:'10px',color:'var(--color-muted)'}}>{collapsed ? '▶' : '▼'}</span>
          </div>
        </div>
      </div>
      {!collapsed && editing ? (
        <div>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder='e.g. Started feeling nausea on week 3. Reduced dose helped.'
            rows={3}
            style={{width:'100%',background:'var(--color-input)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'12px',boxSizing:'border-box',resize:'none',marginBottom:'8px'}}
          />
          <div style={{display:'flex',gap:'6px'}}>
            <button onClick={() => setEditing(false)} style={{flex:1,background:'var(--color-card)',color:'var(--color-dim)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'7px',fontSize:'12px',cursor:'pointer'}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{flex:2,background:'var(--color-green)',color:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'7px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      ) : !collapsed && notes ? (
        <p style={{fontSize:'12px',color:'var(--color-dim)',margin:0,lineHeight:'1.6'}}>{notes}</p>
      ) : null}
    </div>
  )
}
