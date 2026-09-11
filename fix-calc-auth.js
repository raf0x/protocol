const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Replace the save button to check auth first
content = content.replace(
  "<button onClick={() => setShowSaveFlow(true)} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>",
  "<button onClick={async () => { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setShowSaveFlow(true) } else { setShowSaveFlow(true) } }} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>"
);

// Update saveToProtocol to handle not-logged-in gracefully
content = content.replace(
  "    if (!user) { window.location.href = '/auth/login'; return }",
  "    if (!user) { setSavingProtocol(false); setSaveSuccess(false); setShowSaveFlow(false); setNeedsLogin(true); return }"
);

// Add needsLogin state
content = content.replace(
  "  const [saveSuccess, setSaveSuccess] = useState(false)",
  "  const [saveSuccess, setSaveSuccess] = useState(false)\n  const [needsLogin, setNeedsLogin] = useState(false)"
);

// Add login prompt after saveSuccess block
content = content.replace(
  "          {saveSuccess && (",
  `          {needsLogin && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd,textAlign:'center'}}>
              <span style={{fontSize:'13px',color:dg}}>Sign in to save this to your protocol</span>
              <a href='/auth/login' style={{display:'block',marginTop:'10px',background:g,color:'#000',textDecoration:'none',fontWeight:'700',padding:'12px',borderRadius:'6px',fontSize:'14px',textAlign:'center'}}>Sign in / Create account</a>
            </div>
          )}

          {saveSuccess && (`
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
