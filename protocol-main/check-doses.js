const fs = require('fs');
const content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (i >= 55 && i <= 75) console.log((i+1) + ': ' + line.trim().slice(0, 120));
});
