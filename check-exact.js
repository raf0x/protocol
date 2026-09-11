const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Show lines 112-135 and 150-168 to get exact content
lines.slice(111, 135).forEach((line, i) => console.log((i+112) + ': ' + line));
console.log('---');
lines.slice(149, 168).forEach((line, i) => console.log((i+150) + ': ' + line));
