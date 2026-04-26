const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add missedDoses state
content = content.replace(
  `const [saved, setSaved] = useState(false)`,
  `const [saved, setSaved] = useState(false)
  const [missedDoses, setMissedDoses] = useState<string[]>([])`
);

// Compute missed doses after loadAll sets logs and dueCompounds
content = content.replace(
  `setLoading(false)
    } catch (err) {`,
  `// Missed dose detection — flag due compounds not logged after 8pm
    const hour = new Date().getHours()
    if (hour >= 20) {
      const logMap: Record<string, boolean> = {}
      ;(ls || []).forEach((l: any) => { if (l.taken) logMap[l.compound_id] = true })
      const missed = due.filter((c: any) => !logMap[c.id]).map((c: any) => c.name)
      setMissedDoses(missed)
    }
    setLoading(false)
    } catch (err) {`
);

// Add missed dose banner in JSX — after createSuccess block, before insights
content = content.replace(
  `        {/* Insights — InsightsCard component */}`,
  `        {/* Missed dose banner */}
        {missedDoses.length > 0 && (
          <div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'12px',padding:'14px 16px',marginBottom:'16px',display:'flex',alignItems:'flex-start',gap:'10px'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>&#9888;</span>
            <div>
              <span style={{fontSize:'12px',fontWeight:'700',color:'#f97316',display:'block',marginBottom:'2px'}}>Looks like you may have missed a dose today</span>
              <span style={{fontSize:'12px',color:'var(--color-dim)'}}>{missedDoses.join(', ')} {missedDoses.length === 1 ? 'was' : 'were'} due but not logged. Tap the compound tab to log it.</span>
            </div>
          </div>
        )}

        {/* Insights — InsightsCard component */}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
