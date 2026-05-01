const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Remove the misplaced useEffect
content = content.replace(
  `  // Recalculate missed doses whenever logs or dueCompounds change
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 20) { setMissedDoses([]); return }
    const missed = dueCompounds.filter((c: any) => !logs[c.id]?.taken).map((c: any) => c.name)
    setMissedDoses(missed)
  }, [logs, dueCompounds])`,
  ``
);

// Find a better place - after all useState declarations, before loadAll function
content = content.replace(
  `  useEffect(() => { loadAll() }, [])`,
  `  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 20) { setMissedDoses([]); return }
    const missed = dueCompounds.filter((c: any) => !logs[c.id]?.taken).map((c: any) => c.name)
    setMissedDoses(missed)
  }, [logs, dueCompounds])

  useEffect(() => { loadAll() }, [])`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
