const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

const newLines = [
"  // vial_unit='IU' means real IU vial (HCG) - use concentration math",
"  // vial_unit='mg' means mg vial with IU syringe units (Reta, CJC etc) - use /100",
"  const vialUnit = activeCompound.vial_unit || 'mg'",
"  const mlPerDose = vialUnit === 'IU' && vialStrength > 0 && bacWater > 0",
"    ? currentPhase.dose / (vialStrength / bacWater)",
"    : currentPhase.dose_unit === 'IU'",
"      ? currentPhase.dose / 100",
"      : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)",
];

// Replace lines 165-167 (0-indexed 164-166)
const result = [...lines.slice(0, 164), ...newLines, ...lines.slice(167)];
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Done!');
