const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Show lines 118-130 to confirm exact content
lines.slice(117, 130).forEach((line, i) => console.log((i+118) + ': ' + line));
