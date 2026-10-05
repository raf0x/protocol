'use client'
import { useState, useEffect, useRef, useId } from 'react'
import { createClient } from '../../lib/supabase'
import { formatProtocolAmount } from '../../lib/health/dosingEntry'
import styles from './VialInventory.module.css'

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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [newReconDate, setNewReconDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [newBacWater, setNewBacWater] = useState(bacWaterMl ? String(bacWaterMl) : '')
  const [newVialStrength, setNewVialStrength] = useState(vialStrength ? String(vialStrength) : '')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogId = useId()

  useEffect(() => {
    if (!showNewVial) return
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    dialog.querySelector<HTMLInputElement>('input')?.focus()
    return () => {
      dialog.close()
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [showNewVial])

  useEffect(() => {
    if (showNewVial && saveError) dialogRef.current?.querySelector<HTMLElement>('[role="alert"]')?.focus()
  }, [showNewVial, saveError])

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
    setSaveError(null)
    setNewReconDate(new Date().toLocaleDateString('en-CA'))
    setNewBacWater(bacWaterMl ? String(bacWaterMl) : '')
    setNewVialStrength(vialStrength ? String(vialStrength) : '')
    setShowNewVial(true)
  }

  async function confirmNewVial() {
    if (Number(newBacWater) !== Number(bacWaterMl) || Number(newVialStrength) !== Number(vialStrength)) { window.location.href = `/protocol/manage?compound=${compoundId}&reconstitution_vial=${encodeURIComponent(newVialStrength)}&reconstitution_water=${encodeURIComponent(newBacWater)}&reconstitution_date=${encodeURIComponent(newReconDate)}`; return }
    setSaving(true)
    setSaveError(null)
    try {
      const supabase = createClient()
      const next = Math.max(0, (count || 1) - 1)
      const parsedStrength = newVialStrength ? parseFloat(newVialStrength) : vialStrength
      const { error } = await supabase.from('compounds').update({
        vials_in_stock: next,
        doses_taken_override: 0,
        reconstitution_date: newReconDate,
        bac_water_ml: newBacWater ? parseFloat(newBacWater) : bacWaterMl,
        vial_strength: parsedStrength
      }).eq('id', compoundId)
      if (error) throw error
      setCount(next)
      try { window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
      setShowNewVial(false)
    } catch {
      setSaveError('Your new vial wasn’t saved. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const daysElapsed = reconstitutionDate
    ? Math.floor((Date.now() - new Date(reconstitutionDate + 'T00:00:00').getTime()) / 86400000)
    : null
  const expiryDays = 28
  const daysLeft = daysElapsed !== null ? Math.max(0, expiryDays - daysElapsed) : null
  const progress = daysElapsed !== null ? Math.min(100, (daysElapsed / expiryDays) * 100) : 0
  const barColor = progress < 50 ? '#22c55e' : progress < 80 ? '#f59e0b' : '#ef4444'
  const strengthChanged = newVialStrength && vialStrength && parseFloat(newVialStrength) !== vialStrength

  if (loading) return <div className="vial-inventory" style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)',fontSize:'11px',color:'var(--color-muted)'}}>Loading...</div>

  return (
    <div className="vial-inventory" style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)'}}>

      {showNewVial && (
        <dialog ref={dialogRef} id={dialogId} className={styles.newVialDialog} aria-modal="true" aria-labelledby={dialogId + '-title'}
          onCancel={event => { event.preventDefault(); setShowNewVial(false) }}
          onKeyDown={event => {
            if (event.key !== 'Tab') return
            const fields = Array.from(event.currentTarget.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button')).filter(field => !field.disabled)
            const first = fields[0], last = fields[fields.length - 1]
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
          }}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'2px',marginBottom:'8px'}}>NEW VIAL</div>
            <h3 id={dialogId + '-title'} style={{fontSize:'18px',fontWeight:'800',color:'var(--color-text)',marginBottom:'4px'}}>Starting a new {compoundName} vial?</h3>
            <p style={{fontSize:'12px',color:'var(--color-dim)',marginBottom:'20px'}}>Your previous vial will be marked as finished. Doses taken will reset to 0.</p>

            <label htmlFor={dialogId + '-strength'} style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>VIAL STRENGTH ({vialUnit || 'mg'})</label>
            <input id={dialogId + '-strength'} type='number' step='any' value={newVialStrength} onChange={e => setNewVialStrength(e.target.value)} placeholder='e.g. 10' style={{width:'100%',background:'var(--color-surface)',border:'1px solid '+(strengthChanged ? '#f59e0b' : 'var(--color-border)'),borderRadius:'8px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'4px'}} />
            {strengthChanged && (
              <div style={{fontSize:'11px',color:'#f59e0b',marginBottom:'12px',lineHeight:'1.4'}}>
                ⚠ Changed from {formatProtocolAmount(vialStrength, vialUnit) ?? 'an amount without a recorded unit'}. Your mL-per-dose may need updating too.
              </div>
            )}
            {!strengthChanged && <div style={{marginBottom:'12px'}} />}

            <label htmlFor={dialogId + '-date'} style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>RECONSTITUTION DATE</label>
            <input id={dialogId + '-date'} type='date' value={newReconDate} onChange={e => setNewReconDate(e.target.value)} style={{width:'100%',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'12px',colorScheme:'dark'}} />
            <label htmlFor={dialogId + '-water'} style={{fontSize:'11px',color:'var(--color-dim)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>BAC WATER (mL)</label>
            <input id={dialogId + '-water'} type='number' step='0.5' value={newBacWater} onChange={e => setNewBacWater(e.target.value)} placeholder='e.g. 3.0' style={{width:'100%',background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'10px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box',marginBottom:'20px'}} />
            {saveError && <p role="alert" tabIndex={-1} style={{fontSize:'12px',color:'var(--app-error)',marginBottom:'12px'}}>{saveError}</p>}
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setShowNewVial(false)} style={{flex:1,background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'12px',color:'var(--color-dim)',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
              <button onClick={confirmNewVial} disabled={saving} style={{flex:2,background:'#39ff14',color:'#000',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'800',cursor:'pointer'}}>{saving ? 'Saving...' : 'Log New Vial'}</button>
            </div>
        </dialog>
      )}

      {/* Vial lifecycle: label, day badge, and the new-vial trigger on one row; bar underneath */}
      {reconstitutionDate && daysElapsed !== null && (
        <div className="vial-lifecycle">
          <div className="vial-lifecycle-toolbar" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',gap:'8px',flexWrap:'wrap'}}>
            <span className="vial-lifecycle-title" style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'1px'}}>VIAL LIFECYCLE</span>
            <span className="vial-lifecycle-status" style={{fontSize:'13px',fontWeight:'700',color:barColor}}>
              Day {daysElapsed}/{expiryDays}
              {daysLeft !== null && daysLeft > 0 && <span style={{fontSize:'11px',fontWeight:'600',color:'var(--color-dim)',marginLeft:'6px'}}>({daysLeft}d left)</span>}
              {daysLeft === 0 && <span style={{fontSize:'11px',fontWeight:'700',color:'#ef4444',marginLeft:'6px'}}>(EXPIRED)</span>}
            </span>
            <button ref={triggerRef} className="vial-new-button" onClick={handleNewVial} aria-haspopup="dialog" aria-controls={showNewVial ? dialogId : undefined} style={{background:'var(--color-green-10)',border:'1px solid var(--color-green-30)',borderRadius:'6px',padding:'5px 10px',color:'#39ff14',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>+ New Vial</button>
          </div>
          <div className="vial-lifecycle-track" style={{width:'100%',height:'6px',background:'var(--color-surface)',borderRadius:'3px',overflow:'hidden',border:'1px solid var(--color-border)'}}>
            <div style={{width:`${progress}%`,height:'100%',background:barColor,transition:'width 0.3s ease, background 0.3s ease'}} />
          </div>
        </div>
      )}
    </div>
  )
}
