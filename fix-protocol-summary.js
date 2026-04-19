const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// #1: Add activeProtocols state
content = content.replace(
  "  const [showChart, setShowChart] = useState(false)",
  "  const [showChart, setShowChart] = useState(false)\n  const [activeProtocols, setActiveProtocols] = useState<any[]>([])"
);

// Store protocols data for the summary card
content = content.replace(
  "    const due: DueCompound[] = []\n    ;(protocols || []).forEach((p: any) => {",
  "    setActiveProtocols(protocols || [])\n    const due: DueCompound[] = []\n    ;(protocols || []).forEach((p: any) => {"
);

// #2: Change subtitle to emotional copy
content = content.replace(
  "        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>Log your day. Track your progress.</p>",
  "        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>You're building something. Keep going.</p>"
);

// #2: Make Current Week emotional
content = content.replace(
  "            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT WEEK</div>",
  "            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>WEEK OF CYCLE</div>"
);

// #1: Insert Current Protocol card between stats and insights
content = content.replace(
  "        {/* Insights */}",
  `        {/* Current Protocol */}
        {activeProtocols.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>ACTIVE STACK</div>
            {activeProtocols.map((p: any) => {
              const startMs = new Date(p.start_date + 'T00:00:00').getTime()
              const daysIn = Math.floor((Date.now() - startMs) / 86400000)
              const wk = Math.max(1, Math.floor(daysIn / 7) + 1)
              return (p.compounds || []).map((c: any) => {
                const phase = (c.phases || []).find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || c.phases?.[0]
                return phase ? (
                  <div key={c.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid '+bd}}>
                    <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{c.name}</span>
                    <span style={{fontSize:'12px',color:dg}}>{phase.dose}{phase.dose_unit} · {phase.frequency}</span>
                  </div>
                ) : null
              })
            })}
          </div>
        )}

        {/* Insights */}`
);

// #2: Update insights language to be warmer
content = content.replace(
  "text: `Down ${diff.toFixed(1)} lbs since you started tracking`",
  "text: `You're down ${diff.toFixed(1)} lbs since you started — keep going`"
);
content = content.replace(
  "text: `${currentWeek} week${currentWeek > 1 ? 's' : ''} into your cycle`",
  "text: `${currentWeek} week${currentWeek > 1 ? 's' : ''} into your cycle — consistency is paying off`"
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
