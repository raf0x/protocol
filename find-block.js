const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Find and remove the misplaced next dose block (lines 39-62 approx)
const startMarker = '  // Next dose countdown'
const endMarker = '  return ('
const startIdx = lines.findIndex(l => l.trim() === '// Next dose countdown')
const endIdx = lines.findIndex(l => l.trim() === 'return (')

console.log('Start:', startIdx+1, 'End:', endIdx+1)

// Extract the block
const block = lines.slice(startIdx, endIdx)
console.log('Block lines:', block.length)
console.log('First:', block[0])
console.log('Last:', block[block.length-1])
