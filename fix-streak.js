const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add streak calculation after entries are set in loadAll
content = content.replace(
  `setEntries(js || [])`,
  `setEntries(js || [])
    // Calculate logging streak
    let streak = 0
    const today2 = new Date(); today2.setHours(0,0,0,0)
    for (let i = 0; i < 365; i++) {
      const d = new Date(today2); d.setDate(d.getDate() - i)
      const ds = d.toISOString().split('T')[0]
      if ((js || []).find((e: any) => e.date === ds)) { streak++ } else { break }
    }
    setStreakDays(streak)`
);

// Add streak state
content = content.replace(
  `const [loading, setLoading] = useState(true)`,
  `const [loading, setLoading] = useState(true)
  const [streakDays, setStreakDays] = useState(0)`
);

// Add streak to stats bar - replace the subtitle text
content = content.replace(
  `<p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>Every day logged is data working for you.</p>`,
  `<div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'16px'}}>
          <p style={{color:dg,fontSize:'13px',margin:0}}>Every day logged is data working for you.</p>
          {streakDays > 0 && (
            <span style={{fontSize:'12px',fontWeight:'700',color:'#f59e0b',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',padding:'3px 8px',borderRadius:'20px',whiteSpace:'nowrap'}}>
              \uD83D\uDD25 {streakDays} day streak
            </span>
          )}
        </div>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Streak counter added.');
