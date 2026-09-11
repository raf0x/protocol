const fs = require('fs');

// 1. Reorder nav tabs
let nav = fs.readFileSync('components/BottomNav.tsx', 'utf8');
nav = nav.replace(
  "    { href: '/calculator', label: 'Calc' },\n    { href: '/protocol', label: 'Dashboard' },\n    { href: '/journal', label: 'History' },\n    { href: '/community', label: 'Community' },\n    { href: '/profile', label: 'Profile' },",
  "    { href: '/calculator', label: 'Calc' },\n    { href: '/community', label: 'Community' },\n    { href: '/protocol', label: 'Dashboard' },\n    { href: '/journal', label: 'History' },\n    { href: '/profile', label: 'Profile' },"
);
fs.writeFileSync('components/BottomNav.tsx', nav, 'utf8');
console.log('Nav reordered');

// 2 & 3. Move Insights right after stats, Charts right after insights (before Active Compounds)
let dash = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Extract insights block
const insightsBlock = `        {/* Insights */}
        {vi.length > 0 && (<div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}><div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>{vi.map((ins2, i) => (<div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'white'}}><span style={{color:ins2.accent,fontWeight:'700'}}>→</span><span>{ins2.text}</span></div>))}</div>)}`;

// Extract charts block
const chartsToggle = `        {/* Charts */}
        {entries.length > 1 && (<div style={{marginBottom:'16px'}}><button onClick={() => setShowChart(!showChart)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button></div>)}`;

const chartsContent = dash.match(/\{showChart && cd\.length > 1.*?\)}\)}/s)?.[0] || '';

// Remove insights and charts from current positions
dash = dash.replace(insightsBlock, '');
dash = dash.replace(chartsToggle, '');

// Insert insights + charts right after the stats grid
dash = dash.replace(
  "        </div>\n\n        {/* Active Compounds */}",
  `        </div>

${insightsBlock}

${chartsToggle}

        {/* Active Compounds */}`
);

// 4. Brighten tile labels
dash = dash.replace(
  /fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'/g,
  "fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'"
);

fs.writeFileSync('app/protocol/page.tsx', dash, 'utf8');
console.log('Dashboard reordered');

// 5. Fix landing page nav for mobile - hide text links on small screens
let landing = fs.readFileSync('app/page.tsx', 'utf8');
landing = landing.replace(
  `          <a href='#features' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'13px',fontWeight:'500'}}>Features</a>
          <a href='/calculator' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'13px',fontWeight:'500'}}>Calculator</a>
          <a href='#faq' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'13px',fontWeight:'500'}}>FAQ</a>
          <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',fontSize:'14px'}}>Sign in</a>`,
  `          <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',fontSize:'14px',whiteSpace:'nowrap'}}>Sign in</a>`
);

// 6. Rename Protocol Builder to Protocol Dashboard
landing = landing.replace(
  "Protocol Builder",
  "Protocol Dashboard"
);
landing = landing.replace(
  "Compounds, phases, dose progression — all in one place. Exact syringe units, no math errors. Never guess a dose again.",
  "Your daily command center. Active compounds, injection checklist, insights, and progress — all in one scroll."
);

fs.writeFileSync('app/page.tsx', landing, 'utf8');
console.log('Landing fixed');

console.log('All done');
