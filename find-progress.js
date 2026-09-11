const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Find the progress calculation line
lines.forEach((line, i) => {
  if (line.includes('progress') || line.includes('totalDays') || line.includes('daysIn')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
