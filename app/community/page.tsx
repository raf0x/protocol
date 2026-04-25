'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type Cohort = { id: string; name: string; description: string; parent_id: string | null }
type MemberCount = { cohort_id: string; count: number }

export default function CommunityPage() {
  const [username, setUsername] = useState<string | null>(null)
  const [newUsername, setNewUsername] = useState('')
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [joined, setJoined] = useState<string[]>([])
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const mg = 'var(--color-muted)'
  const cb = 'var(--color-card)'
  const bd = 'var(--color-border)'

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    const { data: un } = await supabase.from('usernames').select('username').eq('user_id', user.id).single()
    if (un) setUsername(un.username)
    const { data: ch } = await supabase.from('cohorts').select('*').order('name')
    setCohorts(ch || [])
    const { data: mem } = await supabase.from('cohort_members').select('cohort_id').eq('user_id', user.id)
    setJoined((mem || []).map((m: any) => m.cohort_id))
    const { data: counts } = await supabase.from('cohort_members').select('cohort_id')
    const countMap: Record<string, number> = {}
    ;(counts || []).forEach((m: any) => {
      countMap[m.cohort_id] = (countMap[m.cohort_id] || 0) + 1
    })
    setMemberCounts(countMap)
    setLoading(false)
  }

  async function saveUsername() {
    setError('')
    const clean = newUsername.trim().replace(/[^a-zA-Z0-9_]/g, '')
    if (clean.length < 3) { setError('Username must be at least 3 characters. Letters, numbers, and underscores only.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: e } = await supabase.from('usernames').insert({ user_id: user.id, username: clean })
    if (e) { setError(e.message.includes('unique') ? 'That username is taken. Try another.' : e.message); setSaving(false); return }
    setUsername(clean)
    setSaving(false)
  }

  async function toggleJoin(cohortId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (joined.includes(cohortId)) {
      await supabase.from('cohort_members').delete().eq('user_id', user.id).eq('cohort_id', cohortId)
      setJoined(joined.filter(id => id !== cohortId))
      setMemberCounts(prev => ({ ...prev, [cohortId]: Math.max(0, (prev[cohortId] || 1) - 1) }))
    } else {
      await supabase.from('cohort_members').insert({ user_id: user.id, cohort_id: cohortId })
      setJoined([...joined, cohortId])
      setMemberCounts(prev => ({ ...prev, [cohortId]: (prev[cohortId] || 0) + 1 }))
    }
  }

  const parents = cohorts.filter(c => !c.parent_id)
  const subCohorts = (parentId: string) => cohorts.filter(c => c.parent_id === parentId)

  if (loading) return <main style={{minHeight:'100vh',background:'var(--color-bg)',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  if (!username) {
    return (
      <main style={{minHeight:'100vh',background:'var(--color-bg)',color:'var(--color-text)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px'}}>
        <div style={{maxWidth:'400px',width:'100%'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',marginBottom:'8px',color:g}}>Choose a username</h1>
          <p style={{color:dg,fontSize:'13px',marginBottom:'24px'}}>Your username is how you appear in cohorts. It cannot be changed later. No personal information is visible to other users.</p>
          <input value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder='e.g. peptide_tracker' style={{width:'100%',background:cb,border:'1px solid '+bd,borderRadius:'6px',padding:'12px',color:'var(--color-text)',fontSize:'16px',outline:'none',boxSizing:'border-box',marginBottom:'12px'}} />
          {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'12px'}}>{error}</div>}
          <button onClick={saveUsername} disabled={saving} style={{width:'100%',background:saving?'var(--color-green-20)':g,color:saving?'var(--color-muted)':'var(--color-green-text)',fontWeight:'700',padding:'14px',borderRadius:'6px',border:'none',fontSize:'16px',cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':'Set username'}</button>
          <p style={{color:mg,fontSize:'11px',marginTop:'16px',textAlign:'center'}}>Letters, numbers, and underscores only. Minimum 3 characters.</p>
        </div>
      </main>
    )
  }

  return (
    <main style={{minHeight:'100vh',background:'var(--color-bg)',color:'var(--color-text)',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:g}}>Community</h1>
          <span style={{fontSize:'12px',color:mg}}>@{username}</span>
        </div>
        <p style={{color:dg,fontSize:'13px',marginBottom:'24px'}}>Join cohorts to read experiences from others. No vendor discussion allowed.</p>
        {parents.map(parent => (
          <div key={parent.id} style={{marginBottom:'24px'}}>
            <h2 style={{fontSize:'16px',fontWeight:'700',color:g,marginBottom:'12px'}}>{parent.name}</h2>
            {subCohorts(parent.id).map(sub => {
              const isJoined = joined.includes(sub.id)
              const count = memberCounts[sub.id] || 0
              return (
                <div key={sub.id} style={{background:cb,border:'1px solid '+(isJoined?'var(--color-green)':'var(--color-border)'),borderRadius:'8px',padding:'14px',marginBottom:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                      <span style={{fontSize:'14px',fontWeight:'600',color:isJoined?g:'white'}}>{sub.name}</span>
                      {isJoined && <span style={{fontSize:'10px',color:'var(--color-green-text)',background:'var(--color-green)',padding:'2px 8px',borderRadius:'4px',fontWeight:'700'}}>JOINED</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                      <p style={{fontSize:'12px',color:mg,margin:0}}>{sub.description}</p>
                      {count > 0 && <span style={{fontSize:'12px',color:dg,fontWeight:'600'}}>· {count} {count===1?'member':'members'}</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'8px',marginLeft:'12px'}}>
                    {isJoined && (
                      <button onClick={() => router.push('/community/cohorts/'+sub.id)} style={{background:'var(--color-surface)',color:'var(--color-dim)',fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer',border:'1px solid var(--color-border)'}}>View</button>
                    )}
                    <button onClick={() => toggleJoin(sub.id)} style={{background:isJoined?'rgba(255,107,107,0.1)':'var(--color-surface)',border:'1px solid '+(isJoined?'rgba(255,107,107,0.4)':'var(--color-border)'),color:isJoined?'#ff6b6b':'var(--color-dim)',fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer'}}>{isJoined?'Leave':'Join'}</button>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </main>
  )
}