const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Add imports at top
content = content.replace(
  `'use client'
import React from 'react'`,
  `'use client'
import React from 'react'
import CompoundNotes from './CompoundNotes'
import VialInventory from './VialInventory'`
);

// Add shareProtocol function and extra props
content = content.replace(
  `type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  logs: Record<string, LogEntry>
  allLogs: { compound_id: string; taken: boolean; date: string }[]
  totalLost: string | null
  compoundIndex: number
}`,
  `type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  logs: Record<string, LogEntry>
  allLogs: { compound_id: string; taken: boolean; date: string }[]
  totalLost: string | null
  compoundIndex: number
  onShare: (protocolId: string) => void
}`
);

content = content.replace(
  `export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost, compoundIndex }: Props) {`,
  `export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost, compoundIndex, onShare }: Props) {`
);

// Add CompoundNotes, VialInventory, share button before closing div
content = content.replace(
  `    </div>
  )
}`,
  `      <div style={{marginTop:'14px',paddingTop:'14px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
        <CompoundNotes compoundId={activeCompound.id} initialNotes={activeCompound.notes || ''} />
        <VialInventory compoundId={activeCompound.id} compoundName={activeCompound.name} />
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'10px'}}>
          <a href='/protocol/manage' style={{color:'rgba(255,255,255,0.4)',textDecoration:'none',fontSize:'12px',fontWeight:'600'}}>+ Add / Edit Protocols \u2192</a>
          <button onClick={() => onShare(activeProtocol.id)} style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',padding:'6px 12px',color:'rgba(255,255,255,0.5)',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share \u2192</button>
        </div>
      </div>
    </div>
  )
}`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Done! HeroProtocolCard updated.');
