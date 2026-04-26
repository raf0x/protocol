const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add error state
content = content.replace(
  `const [loading, setLoading] = useState(true)`,
  `const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)`
);

// Wrap loadAll with try/catch
content = content.replace(
  `async function loadAll() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }`,
  `async function loadAll() {
    setLoading(true)
    setLoadError(false)
    try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }`
);

// Close try/catch before setLoading(false) at end of loadAll
content = content.replace(
  `setProtocolEvents(events || [])
    setLoading(false)
  }`,
  `setProtocolEvents(events || [])
    setLoading(false)
    } catch (err) {
      console.error('loadAll failed:', err)
      setLoadError(true)
      setLoading(false)
    }
  }`
);

// Add error UI after loading check
content = content.replace(
  `if (loading) return <main style={{minHeight:'100vh',color:'var(--color-dim)',display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>`,
  `if (loading) return <main style={{minHeight:'100vh',color:'var(--color-dim)',display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>
  if (loadError) return <main style={{minHeight:'100vh',color:'var(--color-dim)',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:'12px'}}><span style={{fontSize:'24px'}}>?</span><p style={{color:'var(--color-dim)',fontSize:'14px'}}>Something went wrong loading your data.</p><button onClick={loadAll} style={{background:'var(--color-green)',color:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'10px 20px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>Try again</button></main>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Priority 2 done!');
