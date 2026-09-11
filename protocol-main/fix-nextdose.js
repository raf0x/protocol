const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Add next dose calculation after fillPct
content = content.replace(
  `  return (`,
  `  // Next dose countdown
  let nextDoseText: string | null = null
  if (currentPhase && activeProtocol) {
    try {
      const ph = currentPhase as any
      const today3 = new Date(); today3.setHours(0,0,0,0)
      const compoundLogs = allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken)
      const lastLog = compoundLogs.sort((a: any, b: any) => b.date.localeCompare(a.date))[0]
      if (lastLog) {
        const lastDate = new Date(lastLog.date + 'T00:00:00')
        const freq = ph.frequency || '1x/week'
        const gapDays = freq === 'daily' ? 1 : freq === 'eod' ? 2 : freq === 'every3days' ? 3 : freq === 'every4days' ? 4 : freq === '1x/week' ? 7 : freq === '2x/week' ? 3 : freq === '3x/week' ? 2 : 1
        const nextDate = new Date(lastDate); nextDate.setDate(nextDate.getDate() + gapDays)
        const diffMs = nextDate.getTime() - today3.getTime()
        const diffDays = Math.ceil(diffMs / 86400000)
        if (diffDays <= 0) nextDoseText = 'Due today'
        else if (diffDays === 1) nextDoseText = 'Tomorrow'
        else nextDoseText = 'In ' + diffDays + ' days'
      }
    } catch(e) {}
  }

  return (`
);

// Add next dose badge next to week badge
content = content.replace(
  `{currentPhase && <span style={{fontSize:'12px',color:'var(--color-dim)'}}>{currentPhase.dose}{currentPhase.dose_unit} \u00b7 {currentPhase.frequency}</span>}`,
  `{currentPhase && <span style={{fontSize:'12px',color:'var(--color-dim)'}}>{currentPhase.dose}{currentPhase.dose_unit} \u00b7 {currentPhase.frequency}</span>}
            {nextDoseText && <span style={{fontSize:'12px',fontWeight:'700',color:nextDoseText==='Due today'?'#f97316':'var(--color-dim)',background:nextDoseText==='Due today'?'rgba(249,115,22,0.1)':'var(--color-surface)',padding:'3px 8px',borderRadius:'20px'}}>\u23F0 {nextDoseText}</span>}`
);

// Add Refill Needed button on vial when empty
content = content.replace(
  `<div style={{marginLeft:'16px',flexShrink:0,filter:'drop-shadow(0 6px 20px rgba(0,0,0,0.6))'}}>\n          <DynamicVial name={activeCompound.name} color={color} fillPct={fillPct} />`,
  `<div style={{marginLeft:'16px',flexShrink:0,filter:'drop-shadow(0 6px 20px rgba(0,0,0,0.6))',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
            <DynamicVial name={activeCompound.name} color={color} fillPct={fillPct} />
            {fillPct <= 0.05 && (
              <span style={{fontSize:'10px',fontWeight:'700',color:'#ff6b6b',background:'rgba(255,107,107,0.1)',border:'1px solid rgba(255,107,107,0.3)',borderRadius:'6px',padding:'4px 8px',whiteSpace:'nowrap',cursor:'pointer'}} onClick={() => {
                const el = document.getElementById('new-vial-btn-' + activeCompound.id)
                if (el) el.click()
              }}>Refill needed</span>
            )}`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Done!');
