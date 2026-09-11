const fs = require('fs');
const content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('fill*100') || line.includes('Math.round(fill') || line.includes('0.42')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
