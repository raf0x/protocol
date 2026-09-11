const fs = require('fs');

const files = ['app/protocol/page.tsx', 'components/dashboard/DailyLogCard.tsx', 'app/journal/page.tsx'];

files.forEach(filepath => {
  if (!require('fs').existsSync(filepath)) return;
  let content = require('fs').readFileSync(filepath, 'utf8');

  // Add a HungerBtn with reversed colors
  content = content.replace(
    `function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) { const a = current === value; const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']; const sc = scoreColors[value-1]; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?sc:cb,color:a?'#fff':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:a?1:0.5}}>{value}</button> }`,
    `function ScoreBtn({ value, current, onChange, reverse }: { value: number; current: number | null; onChange: (v: number) => void; reverse?: boolean }) { const a = current === value; const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']; const reverseColors = ['#22c55e','#84cc16','#eab308','#f97316','#ef4444']; const sc = (reverse ? reverseColors : scoreColors)[value-1]; return <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid '+bd,background:a?sc:cb,color:a?'#fff':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:a?1:0.5}}>{value}</button> }`
  );

  require('fs').writeFileSync(filepath, content, 'utf8');
  console.log('Updated: ' + filepath);
});
