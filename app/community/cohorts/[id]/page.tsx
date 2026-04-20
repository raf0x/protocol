'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '../../../../lib/supabase'
import { useRouter } from 'next/navigation'

const BLOCKED_WORDS = ['source','vendor','buy','purchase','supplier','website','shop','order','link','dm','discord','telegram','whatsapp','price','cost','cheap','discount','promo','code','sale']

type Post = { id: string; username: string; content: string; tag: string | null; created_at: string }
type Cohort = { id: string; name: string; description: string }

export default function CohortPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [cohort, setCohort] = useState<Cohort | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [username, setUsername] = useState('')
  const [content, setContent] = useState('')
  const [tag, setTag] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [search, setSearch] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const router = useRouter()
  const g = '#39ff14'
  const dg = '#4dbd4d'
  const mg = '#2d5a2d'
  const cb = '#0d0d0d'
  const bd = '#1a1a1a'

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login'); return }
    setUserId(user.id)
    const { data: un } = await supabase.from('usernames').select('username').eq('user_id', user.id).single()
    if (un) setUsername(un.username)
    const { data: ch } = await supabase.from('cohorts').select('*').eq('id', id).single()
    if (ch) setCohort(ch)
    const { data: p } = await supabase.from('cohort_posts').select('*').eq('cohort_id', id).order('created_at', { ascending: false })
    setPosts(p || [])
    setLoading(false)
  }

  function containsBlockedWord(text: string) {
    const lower = text.toLowerCase()
    return BLOCKED_WORDS.some(word => lower.includes(word))
  }

  async function submitPost() {
    setError('')
    if (!content.trim()) { setError('Please write something before posting.'); return }
    if (content.trim().length < 10) { setError('Post must be at least 10 characters.'); return }
    if (containsBlockedWord(content)) { setError('Your post contains language that is not allowed. Remove any references to vendors, sourcing, or purchasing.'); return }
    setPosting(true)
    const supabase = createClient()
    const { error: e } = await supabase.from('cohort_posts').insert({
      user_id: userId,
      cohort_id: id,
      username,
      content: content.trim(),
      tag: tag || null,
    })
    if (e) { setError(e.message); setPosting(false); return }
    setContent('')
    setTag('')
    setPosting(false)
    loadData()
  }

  async function deletePost(postId: string) {
    const supabase = createClient()
    await supabase.from('cohort_posts').delete().eq('id', postId)
    loadData()
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return mins + 'm ago'
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return hrs + 'h ago'
    return Math.floor(hrs / 24) + 'd ago'
  }

  const filteredPosts = posts.filter(post => {
    const matchesTag = filterTag === '' || post.tag === filterTag
    const matchesSearch = search === '' || post.content.toLowerCase().includes(search.toLowerCase()) || post.username.toLowerCase().includes(search.toLowerCase())
    return matchesTag && matchesSearch
  })

  if (loading) return <main style={{minHeight:'100vh',background:'#000000',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',background:'#000000',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <button onClick={() => router.push('/community')} style={{background:'none',border:'none',color:mg,fontSize:'13px',cursor:'pointer',padding:0,marginBottom:'16px'}}>Back to community</button>
        <h1 style={{fontSize:'22px',fontWeight:'bold',color:g,marginBottom:'4px'}}>{cohort?.name}</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'24px'}}>{cohort?.description}</p>
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'16px',marginBottom:'24px'}}>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder='Share an observation, experience, or question...' rows={3} style={{width:'100%',background:'#000000',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',resize:'none',outline:'none',boxSizing:'border-box',marginBottom:'10px'}} />
          <div style={{display:'flex',gap:'8px',marginBottom:'10px',flexWrap:'wrap'}}>
            {['observation','side effect','question','milestone'].map(t => (
              <button key={t} onClick={() => setTag(tag===t?'':t)} style={{background:tag===t?'#0a1a0a':'none',border:'1px solid '+(tag===t?mg:bd),color:tag===t?dg:mg,fontSize:'11px',padding:'4px 8px',borderRadius:'4px',cursor:'pointer'}}>{t}</button>
            ))}
          </div>
          {error && <div style={{background:'#1a0000',border:'1px solid #4a0000',borderRadius:'6px',padding:'10px',fontSize:'13px',color:'#ff6b6b',marginBottom:'10px'}}>{error}</div>}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'11px',color:mg}}>Posting as @{username}</span>
            <button onClick={submitPost} disabled={posting} style={{background:posting?'#1a3d1a':g,color:posting?mg:'#000000',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',border:'none',fontSize:'14px',cursor:posting?'not-allowed':'pointer'}}>{posting?'Posting...':'Post'}</button>
          </div>
        </div>
        <div style={{background:'#0a1a0a',border:'1px solid '+mg,borderRadius:'6px',padding:'10px',marginBottom:'20px'}}>
          <p style={{fontSize:'11px',color:mg,margin:0}}>No vendor names, sourcing links, purchasing info, or contact details. Posts violating these rules are automatically blocked.</p>
        </div>
        <div style={{marginBottom:'16px'}}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search posts...' style={{width:'100%',background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'6px',padding:'8px 12px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none',marginBottom:'8px'}} />
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
            {['', 'observation', 'side effect', 'question', 'milestone'].map(t => (
              <button key={t} onClick={() => setFilterTag(t)} style={{background:filterTag===t?'#1a1a3e':'none',border:'1px solid '+(filterTag===t?'#6c63ff':'#1e1e2e'),color:filterTag===t?'#6c63ff':'#3d3d5c',fontSize:'11px',padding:'4px 10px',borderRadius:'4px',cursor:'pointer'}}>{t === '' ? 'All' : t}</button>
            ))}
          </div>
        </div>
        {filteredPosts.length === 0 && search === '' && filterTag === '' && <div style={{textAlign:'center',padding:'48px 0'}}><p style={{color:dg}}>No posts yet.</p><p style={{color:mg,fontSize:'13px'}}>Be the first to share an experience.</p></div>}
        {filteredPosts.map(post => (
          <div key={post.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'13px',fontWeight:'700',color:dg}}>@{post.username}</span>
                {post.tag && <span style={{fontSize:'10px',color:mg,background:'#0a1a0a',padding:'2px 6px',borderRadius:'4px'}}>{post.tag}</span>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                <span style={{fontSize:'11px',color:mg}}>{timeAgo(post.created_at)}</span>
                {post.username === username && <button onClick={() => deletePost(post.id)} style={{background:'none',border:'none',color:mg,fontSize:'11px',cursor:'pointer'}}>Delete</button>}
              </div>
            </div>
            <p style={{fontSize:'14px',lineHeight:'1.6',margin:0,color:'#e5e5e5'}}>{post.content}</p>
          </div>
        ))}
      </div>
    </main>
  )
}