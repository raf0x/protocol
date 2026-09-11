const fs = require('fs');
let content = fs.readFileSync('lib/utils.ts', 'utf8');
const lines = content.split('\n');
// Remove line 20 (0-indexed 19) - duplicate todayDay
const result = [...lines.slice(0, 19), ...lines.slice(20)];
fs.writeFileSync('lib/utils.ts', result.join('\n'), 'utf8');
console.log('Done! Removed duplicate todayDay');
