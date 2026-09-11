const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `function ScoreBtn({ value, current, onChange, activeColor = g }: { value: number; current: number | null; onChange: (v: number) => void; activeColor?: string }) { const a = current === value; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?activeColor:cb,color:a?'#000':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{value}</button> }`,
  `function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) { const a = current === value; const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']; const sc = scoreColors[value-1]; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?sc:cb,color:a?'#fff':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:a?1:0.5}}>{value}</button> }`
);

// Remove activeColor props from calls
content = content.split(` activeColor='#f97316'`).join('');
content = content.split(` activeColor='#8b5cf6'`).join('');
content = content.split(` activeColor={g}`).join('');

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('scoreColors') ? 'yes' : 'NO'));
