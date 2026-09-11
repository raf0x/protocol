const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix 1: clear missed doses if all logged
content = content.replace(
  `  // Missed dose detection — flag due compounds not logged after 8pm
  const hour = new Date().getHours()
  if (hour >= 20) {
    const logMap: Record<string, boolean> = {}
    ;(ls || []).forEach((l: any) => { if (l.taken) logMap[l.compound_id] = true })
    const missed = due.filter((c: any) => !logMap[c.id]).map((c: any) => c.name)
    setMissedDoses(missed)
  }`,
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
  }`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
