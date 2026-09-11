const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Add insights computation after the chartData computation
content = content.replace(
  "  const tooltipStyle = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }",
  `  const tooltipStyle = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }

  // Generate insights from user data
  const insights: { text: string; accent: string }[] = []
  if (weightEntries.length >= 2) {
    const first = weightEntries[0]
    const latest = weightEntries[weightEntries.length - 1]
    const diff = first.weight! - latest.weight!
    const daysBetween = Math.max(1, Math.floor((new Date(latest.date).getTime() - new Date(first.date).getTime()) / 86400000))
    const weeksBetween = Math.max(1, daysBetween / 7)
    if (diff > 0) {
      insights.push({ text: \`Down \${diff.toFixed(1)} lbs since you started tracking\`, accent: g })
      if (weeksBetween >= 2) insights.push({ text: \`Averaging \${(diff / weeksBetween).toFixed(1)} lbs lost per week\`, accent: g })
    } else if (diff < 0) {
      insights.push({ text: \`Up \${Math.abs(diff).toFixed(1)} lbs since you started\`, accent: '#f59e0b' })
    }
  }
  if (entries.length >= 5) {
    const moodEntries = entries.filter((e: any) => e.mood !== null)
    if (moodEntries.length >= 3) {
      const avgMood = moodEntries.reduce((s: number, e: any) => s + e.mood, 0) / moodEntries.length
      insights.push({ text: \`Your average mood is \${avgMood.toFixed(1)}/5\`, accent: g })
    }
    const recentWeek = entries.slice(0, 7).filter((e: any) => e.sleep !== null)
    if (recentWeek.length >= 3) {
      const avgSleep = recentWeek.reduce((s: number, e: any) => s + e.sleep, 0) / recentWeek.length
      insights.push({ text: \`Averaging \${avgSleep.toFixed(1)} hours of sleep this week\`, accent: '#06b6d4' })
    }
  }
  const hungerEntries = entries.filter((e: any) => e.hunger !== null && e.hunger !== undefined)
  if (hungerEntries.length >= 3) {
    const avgHunger = hungerEntries.reduce((s: number, e: any) => s + e.hunger, 0) / hungerEntries.length
    if (avgHunger <= 2.5) insights.push({ text: \`Hunger averaging \${avgHunger.toFixed(1)}/5 — appetite suppression working\`, accent: '#8b5cf6' })
    else if (avgHunger >= 4) insights.push({ text: \`Hunger trending high (\${avgHunger.toFixed(1)}/5) — worth noting\`, accent: '#f59e0b' })
  }
  if (currentWeek > 0) {
    insights.push({ text: \`\${currentWeek} week\${currentWeek > 1 ? 's' : ''} into your cycle\`, accent: '#6c63ff' })
  }
  // Pick up to 3
  const visibleInsights = insights.slice(0, 3)
`
);

// Insert insights card right before "Today's injections"
content = content.replace(
  "        {/* Chart toggle */}",
  `        {/* Insights */}
        {visibleInsights.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>
            {visibleInsights.map((ins, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'white'}}>
                <span style={{color:ins.accent,fontWeight:'700'}}>→</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chart toggle */}`
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
