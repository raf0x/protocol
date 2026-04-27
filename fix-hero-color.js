const fs = require('fs');

// Fix 1: add compoundIndex prop to HeroProtocolCard
let hero = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
hero = hero.replace(
  `type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  logs: Record<string, LogEntry>
  allLogs: { compound_id: string; taken: boolean; date: string }[]
  totalLost: string | null
}`,
  `type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  logs: Record<string, LogEntry>
  allLogs: { compound_id: string; taken: boolean; date: string }[]
  totalLost: string | null
  compoundIndex: number
}`
);

hero = hero.replace(
  `export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost }: Props) {`,
  `const RING_COLORS = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635']

export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost, compoundIndex }: Props) {`
);

// Replace the getCompoundColor call with ring color
hero = hero.replace(
  `  const color = getCompoundColor(activeCompound.name)`,
  `  const color = RING_COLORS[compoundIndex] || RING_COLORS[0]`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', hero, 'utf8');
console.log('Done! HeroProtocolCard updated.');

// Fix 2: compute compoundIndex in protocol/page.tsx and pass it
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');

protocol = protocol.replace(
  `        <HeroProtocolCard
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          logs={logs}
          allLogs={allLogs}
          totalLost={tl}
        />`,
  `        <HeroProtocolCard
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          logs={logs}
          allLogs={allLogs}
          totalLost={tl}
          compoundIndex={activeProtocols.flatMap((p: any) => (p.compounds||[])).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
        />`
);

fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('Done! protocol/page.tsx updated.');
