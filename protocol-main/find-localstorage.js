const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('localStorage') || line.includes('override') || line.includes('totalDosesTaken')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
