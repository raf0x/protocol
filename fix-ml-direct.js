const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Also need to add ml_per_dose to the query - check what line it's on
const queryLine = lines.findIndex(l => l.includes('doses_taken_override') && l.includes('compounds('));
console.log('Query line:', queryLine + 1, lines[queryLine]?.trim().slice(0, 120));

// Replace lines 148-153 with ml_per_dose direct lookup
const newMlLines = [
"  // Use ml_per_dose directly if set - most reliable method",
"  const mlPerDoseStored = activeCompound.ml_per_dose || null",
"  const vialUnit = activeCompound.vial_unit || 'mg'",
"  const mlPerDose = mlPerDoseStored !== null",
"    ? mlPerDoseStored",
"    : vialUnit === 'IU' && vialStrength > 0 && bacWater > 0",
"      ? currentPhase.dose / (vialStrength / bacWater)",
"      : currentPhase.dose_unit === 'IU'",
"        ? currentPhase.dose / 100",
"        : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)",
];

// Find exact lines to replace (148-153, 0-indexed 147-152)
const result = [...lines.slice(0, 147), ...newMlLines, ...lines.slice(153)];
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Hero card updated!');
