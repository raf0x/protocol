const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Replace static missed dose calculation with a useEffect that reacts to logs
content = content.replace(
  `  // Missed dose detection - flag due compounds not logged after 8pm
  const hour = new Date().getHours()
  const logMap2: Record<string, boolean> = {}
  ;(ls || []).forEach((l: any) => { if (l.taken) logMap2[l.compound_id] = true })
  if (hour >= 20) {
    const missed = due.filter((c: any) => !logMap2[c.id]).map((c: any) => c.name)
    setMissedDoses(missed)
  } else {
    // Before 8pm - only show banner if there are genuinely unlogged doses AND it's past the scheduled time
    setMissedDoses([])
  }`,
  `  // Missed doses calculated reactively via useEffect below`
);

// Add useEffect after the useState declarations
content = content.replace(
  `  const [streakDays, setStreakDays] = useState(0)`,
  `  const [streakDays, setStreakDays] = useState(0)

  // Recalculate missed doses whenever logs or dueCompounds change
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 20) { setMissedDoses([]); return }
    const missed = dueCompounds.filter((c: any) => !logs[c.id]?.taken).map((c: any) => c.name)
    setMissedDoses(missed)
  }, [logs, dueCompounds])`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
