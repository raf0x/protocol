const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Show line 142 to confirm vial_unit is being read
lines.slice(139, 148).forEach((line, i) => console.log((i+140) + ': ' + line.trim().slice(0, 120)));
