const fs = require('fs');
let content = fs.readFileSync('app/profile/page.tsx', 'utf8');

// Add theme state
content = content.replace(
  "const [notifStatus, setNotifStatus] = useState('')",
  "const [notifStatus, setNotifStatus] = useState('')\n  const [theme, setTheme] = useState('dark')"
);

// Add theme useEffect + toggle function
content = content.replace(
  "useEffect(() => { loadUser() }, [])",
  `useEffect(() => { loadUser() }, [])

  useEffect(() => {
    try { const t = localStorage.getItem('protocol-theme') || 'dark'; setTheme(t) } catch(e) {}
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('protocol-theme', next) } catch(e) {}
    document.documentElement.setAttribute('data-theme', next)
  }`
);

// Add appearance card before sign out button
content = content.replace(
  "<button onClick={handleSignOut}",
  `<div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'8px',padding:'20px',marginBottom:'16px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <h2 style={{fontSize:'14px',fontWeight:'600',color:'var(--color-dim)',marginBottom:'4px'}}>Appearance</h2>
              <p style={{fontSize:'12px',color:'var(--color-muted)',margin:0}}>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</p>
            </div>
            <button onClick={toggleTheme} style={{position:'relative',width:'52px',height:'28px',borderRadius:'14px',border:'1px solid var(--color-border)',background:theme==='light'?'rgba(57,255,20,0.2)':'var(--color-surface)',cursor:'pointer',padding:0,flexShrink:0}}>
              <span style={{position:'absolute',top:'3px',left:theme==='dark'?'3px':'25px',width:'20px',height:'20px',borderRadius:'50%',background:theme==='dark'?'var(--color-dim)':'var(--color-green)',transition:'left 0.2s ease',display:'block'}} />
            </button>
          </div>
        </div>
        <button onClick={handleSignOut}`
);

fs.writeFileSync('app/profile/page.tsx', content, 'utf8');
console.log('Done! Profile toggle added.');
