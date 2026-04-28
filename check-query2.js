const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');
console.log(lines[177]);
