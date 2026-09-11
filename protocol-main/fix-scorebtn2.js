const fs = require('fs');

// Fix ScoreBtn in DailyLogCard
let content = fs.readFileSync('components/dashboard/DailyLogCard.tsx', 'utf8');

content = content.replace(
  `function ScoreBtn({ value, current, onChange, activeColor }: { value: number; current: number | null; onChange: (v: number) => void; activeColor?: string }) {
  const c = activeColor || 'var(--color-green)'
  const a = current === value
  return (
    <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid var(--color-border)',background:a?c:'var(--color-card)',color:a?'var(--color-green-text)':'var(--color-dim)',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>
      {value}
    </button>
  )
}`,
  `function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) {
  const a = current === value
  const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']
  const sc = scoreColors[value-1]
  return (
    <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid var(--color-border)',background:a?sc:'var(--color-card)',color:a?'#fff':'var(--color-dim)',fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:a?1:0.5}}>
      {value}
    </button>
  )
}`
);

// Remove activeColor props from ScoreBtn calls
content = content.split(` activeColor='#f97316'`).join('');
content = content.split(` activeColor='#8b5cf6'`).join('');
content = content.split(` activeColor={g}`).join('');

fs.writeFileSync('components/dashboard/DailyLogCard.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('scoreColors') ? 'yes' : 'NO'));
