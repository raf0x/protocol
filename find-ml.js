const fs = require('fs');
const content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('mlUsed') || line.includes('mlPer') || line.includes('takenCount') || line.includes('concentration') || line.includes('fillPct') || line.includes('compoundLogs')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
