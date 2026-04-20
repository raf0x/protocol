'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [reminderHour, setReminderHour] = useState(20)
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifStatus, setNotifStatus] = useState('')
  const router = useRouter()
  const g = '#4ade80'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'

  useEffect(() => { loadUser() }, [])

  async function loadUser() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }
    setUserId(user.id)
    setEmail(user.email || '')
    const date = new Date(user.created_at)
    setCreatedAt(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
    const { data: sub } = await supabase.from('push_subscriptions').select('reminder_hour').eq('user_id', user.id).single()
    if (sub) { setNotifEnabled(true); setReminderHour(sub.reminder_hour) }
    setLoading(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i) }
    return outputArray
  }

  async function enableNotifications() {
    setNotifLoading(true)
    setNotifStatus('')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setNotifStatus('Permission denied. Enable notifications in your browser settings.'); setNotifLoading(false); return }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''),
      })
      const res = await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, subscription: sub.toJSON(), reminder_hour: reminderHour }),
      })
      if (res.ok) { setNotifEnabled(true); setNotifStatus('Reminders enabled.') }
      else { setNotifStatus('Something went wrong. Try again.') }
    } catch (e: any) {
      console.error('Push error:', e)
      setNotifStatus('Error: ' + (e?.message || String(e)))
    }
    setNotifLoading(false)
  }

  async function disableNotifications() {
    setNotifLoading(true)
    await fetch('/api/push', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId }),
    })
    setNotifEnabled(false)
    setNotifStatus('Reminders disabled.')
    setNotifLoading(false)
  }

  async function updateHour(hour: number) {
    setReminderHour(hour)
    if (notifEnabled) {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, subscription: sub.toJSON(), reminder_hour: hour }),
        })
      }
    }
  }

  const hours = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22]
  function formatHour(h: number) {
    if (h === 12) return '12:00 PM'
    if (h < 12) return h + ':00 AM'
    return (h - 12) + ':00 PM'
  }

  if (loading) return <main style={{minHeight:'100vh',background:'#0a0a0f',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',marginBottom:'24px',color:g}}>Profile</h1>
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'20px',marginBottom:'16px'}}>
          <div style={{marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid '+bd}}>
            <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',fontWeight:'600'}}>EMAIL</span>
            <span style={{fontSize:'15px'}}>{email}</span>
          </div>
          <div>
            <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',fontWeight:'600'}}>MEMBER SINCE</span>
            <span style={{fontSize:'15px'}}>{createdAt}</span>
          </div>
        </div>
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'20px',marginBottom:'16px'}}>
          <h2 style={{fontSize:'14px',fontWeight:'600',color:dg,marginBottom:'4px'}}>Journal reminders</h2>
          <p style={{fontSize:'12px',color:mg,marginBottom:'16px'}}>Get a daily reminder to log your journal entry.</p>
          <div style={{marginBottom:'16px'}}>
            <label style={{fontSize:'12px',color:mg,display:'block',marginBottom:'6px'}}>Reminder time</label>
            <select value={reminderHour} onChange={e => updateHour(parseInt(e.target.value))} style={{background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',width:'100%'}}>
              {hours.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
            </select>
          </div>
          {notifStatus && <p style={{fontSize:'12px',color:notifEnabled?dg:'#ff6b6b',marginBottom:'12px'}}>{notifStatus}</p>}
          {notifEnabled ? (
            <button onClick={disableNotifications} disabled={notifLoading} style={{width:'100%',background:'#1a0000',border:'1px solid #4a0000',color:'#ff6b6b',fontWeight:'700',padding:'12px',borderRadius:'6px',fontSize:'14px',cursor:'pointer'}}>{notifLoading?'Updating...':'Disable reminders'}</button>
          ) : (
            <button onClick={enableNotifications} disabled={notifLoading} style={{width:'100%',background:notifLoading?'#1a3d1a':g,color:notifLoading?mg:'#000000',fontWeight:'700',padding:'12px',borderRadius:'6px',border:'none',fontSize:'14px',cursor:'pointer'}}>{notifLoading?'Enabling...':'Enable reminders'}</button>
          )}
        </div>
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'20px',marginBottom:'16px'}}>
          <h2 style={{fontSize:'14px',fontWeight:'600',color:dg,marginBottom:'12px'}}>About Protocol</h2>
          <p style={{fontSize:'13px',color:mg,lineHeight:'1.6',margin:0}}>Protocol is a personal harm reduction tracking tool. It does not provide medical advice, recommend dosing, or facilitate sourcing of any substances. All data is private to your account.</p>
        </div>
        <button onClick={handleSignOut} style={{width:'100%',background:'#1a0000',border:'1px solid #4a0000',color:'#ff6b6b',fontWeight:'700',padding:'14px',borderRadius:'6px',fontSize:'16px',cursor:'pointer'}}>Sign out</button>
      </div>
    </main>
  )
}