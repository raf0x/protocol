const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');
lines.slice(0, 50).forEach((line, i) => console.log((i+1) + ': ' + line));
