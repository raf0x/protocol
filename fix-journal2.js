const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');
const lines = content.split('\n');

// Replace lines 68-70 (0-indexed 67-69)
lines[67] = `  function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) {`;
lines[68] = `    const isActive = current === value`;
lines[69] = `    const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']; const sc = scoreColors[value-1]`;
// Add the return line after - need to check what's on line 70
console.log('Line 70:', lines[70]);
