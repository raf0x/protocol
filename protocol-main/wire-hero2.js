const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add allLogs state
content = content.replace(
  `const [logs, setLogs] = useState<Record<string, LogEntry>>({})`,
  `const [logs, setLogs] = useState<Record<string, LogEntry>>({})
  const [allLogs, setAllLogs] = useState<any[]>([])`
);

// Load all injection logs (not just today) in loadAll
content = content.replace(
  `const { data: ls } = await supabase.from('injection_logs').select('*').eq('date', today)`,
  `const { data: ls } = await supabase.from('injection_logs').select('*').eq('date', today)
    const { data: allLogsData } = await supabase.from('injection_logs').select('compound_id, taken, date').eq('taken', true)
    setAllLogs(allLogsData || [])`
);

// Update HeroProtocolCard call to pass new props
content = content.replace(
  `        <HeroProtocolCard
          activeProtocols={activeProtocols}
          currentWeek={currentWeek}
          totalLost={tl}
        />`,
  `        <HeroProtocolCard
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          logs={logs}
          allLogs={allLogs}
          totalLost={tl}
        />`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
