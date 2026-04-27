const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add tomorrowCompounds state
content = content.replace(
  `const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])`,
  `const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])
  const [tomorrowCompounds, setTomorrowCompounds] = useState<DueCompound[]>([])`
);

// Compute tomorrow compounds after due compounds are computed
content = content.replace(
  `setDueCompounds(due)`,
  `setDueCompounds(due)

    // Tomorrow compounds
    const tmr: DueCompound[] = []
    const tomorrowDate = new Date(); tomorrowDate.setDate(tomorrowDate.getDate() + 1)
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0]
    ;(protocols || []).forEach((p: any) => {
      const daysIn = Math.max(0, Math.floor((tomorrowDate.getTime() - new Date(p.start_date+'T00:00:00').getTime()) / 86400000))
      const wk = Math.max(1, Math.floor(daysIn/7)+1)
      ;(p.compounds||[]).forEach((c: any) => {
        const phase = (c.phases||[]).find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || c.phases?.[0]
        if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week, tomorrowStr)) {
          tmr.push({ id: c.id, name: c.name, dose: phase.dose, dose_unit: phase.dose_unit || 'mg', volume_ml: 0, syringe_units: 0, time_of_day: phase.time_of_day || 'morning', protocol_name: p.name, start_date: p.start_date, frequency: phase.frequency, day_of_week: phase.day_of_week })
        }
      })
    })
    setTomorrowCompounds(tmr)`
);

// Pass tomorrowCompounds to TodaysInjections
content = content.replace(
  `        <TodaysInjections
          dueCompounds={dueCompounds}
          logs={logs}
          onToggle={toggleInjection}
        />`,
  `        <TodaysInjections
          dueCompounds={dueCompounds}
          tomorrowCompounds={tomorrowCompounds}
          logs={logs}
          onToggle={toggleInjection}
        />`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
