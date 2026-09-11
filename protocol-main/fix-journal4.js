const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');
const lines = content.split('\n');

lines[67] = `  function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) {`;
lines[68] = `    const isActive = current === value`;
lines[69] = `    const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']; const sc = scoreColors[value-1]`;
lines[70] = `    return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:isActive?'none':'1px solid var(--color-border)',background:isActive?sc:'var(--color-card)',color:isActive?'#fff':'var(--color-dim)',fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:isActive?1:0.5}}>{value}</button>`;
lines.splice(71, 0, `  }`);

fs.writeFileSync('app/journal/page.tsx', lines.join('\n'), 'utf8');
console.log('Done!');
