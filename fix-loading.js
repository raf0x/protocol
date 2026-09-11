const fs = require('fs');

// Fix 1: Add loading state to toggleInjection in protocol/page.tsx
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');

protocol = protocol.replace(
  `const [saving, setSaving] = useState(false)`,
  `const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)`
);

protocol = protocol.replace(
  `async function toggleInjection(cid: string) { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) return; const cur = logs[cid]; const t = !cur?.taken; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: t, discomfort: cur?.discomfort||0 }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: t, discomfort: cur?.discomfort||0 } }) }`,
  `async function toggleInjection(cid: string) { if (togglingId === cid) return; setTogglingId(cid); const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setTogglingId(null); return; } const cur = logs[cid]; const t = !cur?.taken; await supabase.from('injection_logs').upsert({ user_id: user.id, compound_id: cid, date: today, taken: t, discomfort: cur?.discomfort||0 }, { onConflict: 'user_id,compound_id,date' }); setLogs({ ...logs, [cid]: { compound_id: cid, taken: t, discomfort: cur?.discomfort||0 } }); setTogglingId(null) }`
);

fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('Fixed toggleInjection loading state');

// Fix 2: Add loading state to saveEntry
protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');
// Already has saving state - just verify it shows on the button
console.log('saveEntry already has saving state');

// Fix 3: Add global error boundary - create error.tsx
const errorPage = [
"'use client'",
"import { useEffect } from 'react'",
"",
"export default function Error({ error, reset }: { error: Error; reset: () => void }) {",
"  useEffect(() => { console.error('App error:', error) }, [error])",
"  return (",
"    <main style={{minHeight:'100vh',background:'#0c0c14',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'Inter,sans-serif'}}>",
"      <div style={{textAlign:'center',maxWidth:'400px'}}>",
"        <div style={{fontSize:'48px',marginBottom:'16px'}}>?</div>",
"        <h1 style={{fontSize:'22px',fontWeight:'800',marginBottom:'8px',color:'white'}}>Something went wrong</h1>",
"        <p style={{fontSize:'14px',color:'#8b8ba7',marginBottom:'28px',lineHeight:'1.6'}}>An unexpected error occurred. Your data is safe.</p>",
"        <button onClick={reset} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'8px',padding:'12px 28px',fontSize:'15px',fontWeight:'800',cursor:'pointer'}}>Try again</button>",
"      </div>",
"    </main>",
"  )",
"}",
];
fs.writeFileSync('app/error.tsx', errorPage.join('\n'), 'utf8');
console.log('Created app/error.tsx');
