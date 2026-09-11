const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

const newLines = [
"  const mlPerDose = currentPhase.dose_unit === 'IU' && vialStrength > 0 && bacWater > 0",
"    ? currentPhase.dose / (vialStrength / bacWater)",
"    : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)",
];

// Replace lines 165-167 (0-indexed 164-166)
const result = [...lines.slice(0, 164), ...newLines, ...lines.slice(167)];
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Done!');
