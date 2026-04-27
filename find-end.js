const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');
lines.slice(389, 440).forEach((line, i) => console.log((i+390) + ': ' + line.trim().slice(0, 120)));
