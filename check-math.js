const fs = require('fs');
const content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Add a temporary console.log to see what allLogs contains
// Find the mlUsed calculation and add debug before it
lines.forEach((line, i) => {
  if (line.includes('compoundLogs') || line.includes('mlUsed') || line.includes('fillPct')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 100));
  }
});
