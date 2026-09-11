const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Show lines 148-165
lines.slice(147, 166).forEach((line, i) => console.log((i+148) + ': ' + line.trim().slice(0, 120)));
