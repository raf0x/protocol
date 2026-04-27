const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `        {/* Hero protocol card */}
        <HeroProtocolCard
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          logs={logs}
          allLogs={allLogs}
          totalLost={tl}
          compoundIndex={activeProtocols.flatMap((p: any) => (p.compounds||[])).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
        />

        {/* Stats — StatsBar component */}
        <StatsBar
          currentWeight={lw ?? null}
          totalLost={tl}
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          setActiveCompoundTab={setActiveCompoundTab}
        />`,
  `        {/* Stats — StatsBar component */}
        <StatsBar
          currentWeight={lw ?? null}
          totalLost={tl}
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          setActiveCompoundTab={setActiveCompoundTab}
        />

        {/* Hero protocol card */}
        <HeroProtocolCard
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          logs={logs}
          allLogs={allLogs}
          totalLost={tl}
          compoundIndex={activeProtocols.flatMap((p: any) => (p.compounds||[])).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
        />`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
