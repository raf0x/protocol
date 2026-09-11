const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Remove lines 126-134 (0-indexed 125-133)
const result = [...lines.slice(0, 125), ...lines.slice(134)];
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Done!');
