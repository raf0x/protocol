const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Find and show the mlPerDose calculation lines
lines.forEach((line, i) => {
  if (line.includes('mlPerDose') || line.includes('mlUsed') || line.includes('vialUnit')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
