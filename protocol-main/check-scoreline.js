const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');

// Show lines 251-253
console.log(lines[250]);
console.log(lines[251]);
console.log(lines[252]);
