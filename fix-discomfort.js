const fs = require('fs');
let content = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');

// Remove the discomfort section entirely
content = content.replace(
  `                {taken && (
                  <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid var(--color-border)'}}>
                    <span style={{fontSize:'10px',color:'var(--color-muted)',display:'block',marginBottom:'6px',letterSpacing:'1px'}}>DISCOMFORT (0 = none)</span>
                    <div style={{display:'flex',gap:'6px'}}>
                      {[0,1,2,3,4,5].map(n => <DiscomfortBtn key={n} value={n} current={dis} onChange={v => onDiscomfort(c.id, v)} />)}
                    </div>
                  </div>
                )}`,
  ``
);

// Remove unused DiscomfortBtn component
content = content.replace(
  `function DiscomfortBtn({ value, current, onChange }: { value: number; current: number; onChange: (v: number) => void }) {
  const a = current === value
  const c = value === 0 ? 'var(--color-green)' : '#ff6b6b'
  return (
    <button onClick={() => onChange(value)} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid '+(a?c:'var(--color-border)'),background:a?(value===0?'var(--color-green-15)':'rgba(255,107,107,0.15)'):'transparent',color:a?c:'var(--color-dim)',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>
      {value}
    </button>
  )
}`,
  ``
);

// Remove unused dis variable
content = content.replace(
  `            const log = logs[c.id]
            const taken = log?.taken || false
            const dis = log?.discomfort || 0`,
  `            const log = logs[c.id]
            const taken = log?.taken || false`
);

// Remove onDiscomfort from Props type
content = content.replace(
  `  onDiscomfort: (id: string, v: number) => void`,
  ``
);

// Remove onDiscomfort from function signature
content = content.replace(
  `export default function TodaysInjections({ dueCompounds, logs, onToggle, onDiscomfort }: Props) {`,
  `export default function TodaysInjections({ dueCompounds, logs, onToggle }: Props) {`
);

fs.writeFileSync('components/dashboard/TodaysInjections.tsx', content, 'utf8');
console.log('Done!');
