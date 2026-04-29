const fs = require('fs');
const content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('background') && (line.includes('111') || line.includes('1a1a') || line.includes('gradient') || line.includes('linear'))) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
