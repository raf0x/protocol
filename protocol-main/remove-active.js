const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');

// Remove lines 364-440 (0-indexed 363-439)
const result = [...lines.slice(0, 363), ...lines.slice(440)];
fs.writeFileSync('app/protocol/page.tsx', result.join('\n'), 'utf8');
console.log('Done! Removed Active Compounds section.');
