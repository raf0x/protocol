const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');

// Remove lines 219-247 (0-indexed: 218-246)
const cleaned = [...lines.slice(0, 218), ...lines.slice(247)];

fs.writeFileSync('app/protocol/page.tsx', cleaned.join('\n'), 'utf8');
console.log('Done! Removed orphaned lines 219-247.');
