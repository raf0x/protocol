const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Extract the next dose block (lines 39-60, 0-indexed 38-59)
const block = lines.slice(38, 60);

// Remove it from current position
const without = [...lines.slice(0, 38), ...lines.slice(60)];

// Find currentPhase definition in the cleaned array
const cpIdx = without.findIndex(l => l.includes('const currentPhase ='));
console.log('currentPhase at line:', cpIdx+1);

// Insert block after currentPhase line
const result = [...without.slice(0, cpIdx+1), ...block, ...without.slice(cpIdx+1)];

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Done! Moved block after currentPhase.');
