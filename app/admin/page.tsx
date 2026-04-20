'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const ADMIN_ID = '41266062-c8a7-4a52-aa9b-c1fb96d1c483'

type Post = {
  id: string
  username: string
  content: string
  tag: string | null
  flagged: boolean
  created_at: string
  cohort_id: string
  cohorts: { name: string }
}

export default function AdminPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [userId, setUserId] = useState('')
  const [filter, setFilter] = useState<'all'|'flagged'>('all')
  const router = useRouter()
  const g = '#4ade80'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'

  useEffect(() => { checkAuth() }, [])

  async function checkAuth() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.id !== ADMIN_ID) { router.push('/'); return }
    setUserId(user.id)
    setAuthorized(true)
    loadPosts(user.id)
  }

  async function loadPosts(uid: string) {
    setLoading(true)
    const res = await fetch('/api/admin', { headers: { 'x-user-id': uid } })
    const data = await res.json()
    setPosts(data.posts || [])
    setLoading(false)
  }

  async function deletePost(id: string) {
    await fetch('/api/admin', { method: 'DELETE', headers: { 'x-user-id': userId, 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    loadPosts(userId)
  }

  async function toggleFlag(id: string, current: boolean) {
    await fetch('/api/admin', { method: 'PATCH', headers: { 'x-user-id': userId, 'Content-Type': 'application/json' }, body: JSON.stringify({ id, flagged: !current }) })
    loadPosts(userId)
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return mins + 'm ago'
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h ago'
    return Math.floor(hrs / 24) + 'd ago'
  }

  if (!authorized) return null

  const filteredPosts = filter === 'flagged' ? posts.filter(p => p.flagged) : posts

  return (
    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'600px',margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
          <h1 style={{fontSize:'24px',fontWeight:'bold',color:g}}>Admin</h1>
          <span style={{fontSize:'12px',color:mg}}>{posts.length} total posts</span>
        </div>
        <p style={{color:mg,fontSize:'13px',marginBottom:'24px'}}>Moderator view — all cohort posts including flagged.</p>
        <div style={{display:'flex',gap:'8px',marginBottom:'24px'}}>
          <button onClick={() => setFilter('all')} style={{background:filter==='all'?'#0a1a0a':'none',border:'1px solid '+(filter==='all'?mg:bd),color:filter==='all'?dg:mg,fontSize:'13px',padding:'6px 14px',borderRadius:'6px',cursor:'pointer'}}>All posts</button>
          <button onClick={() => setFilter('flagged')} style={{background:filter==='flagged'?'#1a0000':'none',border:'1px solid '+(filter==='flagged'?'#4a0000':bd),color:filter==='flagged'?'#ff6b6b':mg,fontSize:'13px',padding:'6px 14px',borderRadius:'6px',cursor:'pointer'}}>Flagged {posts.filter(p=>p.flagged).length > 0 ? '('+posts.filter(p=>p.flagged).length+')' : ''}</button>
        </div>
        {loading && <p style={{color:mg}}>Loading...</p>}
        {!loading && filteredPosts.length === 0 && <p style={{color:mg,textAlign:'center',padding:'48px 0'}}>No posts.</p>}
        {filteredPosts.map(post => (
          <div key={post.id} style={{background:post.flagged?'#1a0000':cb,border:'1px solid '+(post.flagged?'#4a0000':bd),borderRadius:'8px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div>
                <span style={{fontSize:'13px',fontWeight:'700',color:dg}}>@{post.username}</span>
                <span style={{fontSize:'11px',color:mg,marginLeft:'8px'}}>{post.cohorts?.name}</span>
                {post.tag && <span style={{fontSize:'10px',color:mg,background:'#0a1a0a',padding:'2px 6px',borderRadius:'4px',marginLeft:'8px'}}>{post.tag}</span>}
                {post.flagged && <span style={{fontSize:'10px',color:'#ff6b6b',background:'#1a0000',padding:'2px 6px',borderRadius:'4px',marginLeft:'8px'}}>FLAGGED</span>}
              </div>
              <span style={{fontSize:'11px',color:mg}}>{timeAgo(post.created_at)}</span>
            </div>
            <p style={{fontSize:'14px',lineHeight:'1.6',margin:'0 0 12px 0',color:'#e5e5e5'}}>{post.content}</p>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => toggleFlag(post.id, post.flagged)} style={{background:'none',border:'1px solid '+(post.flagged?'#4a0000':bd),color:post.flagged?'#ff6b6b':mg,fontSize:'12px',padding:'4px 10px',borderRadius:'4px',cursor:'pointer'}}>{post.flagged?'Unflag':'Flag'}</button>
              <button onClick={() => deletePost(post.id)} style={{background:'#1a0000',border:'1px solid #4a0000',color:'#ff6b6b',fontSize:'12px',padding:'4px 10px',borderRadius:'4px',cursor:'pointer'}}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}