const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

const newLines = [
"",
"  // Check localStorage for manual doses override - dosesRefresh triggers re-read",
"  let totalDosesTaken = 0",
"  try {",
"    const _refresh = dosesRefresh // reference so React re-runs on change",
"    const override = localStorage.getItem('vial_inventory_' + activeCompound.id + '_doses')",
"    if (override !== null) {",
"      totalDosesTaken = parseInt(override)",
"    } else {",
"      totalDosesTaken = allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken).length",
"    }",
"  } catch(e) {",
"    totalDosesTaken = allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken).length",
"  }",
"  const mlPerDose = currentPhase.dose_unit === 'IU'",
"    ? currentPhase.dose / 100",
"    : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)",
"  const mlUsed = totalDosesTaken * mlPerDose",
"  mlRemaining = Math.max(0, bacWater - mlUsed)",
"  fillPct = bacWater > 0 ? mlRemaining / bacWater : 1",
];

// Replace lines 148-166 (0-indexed 147-165)
const result = [...lines.slice(0, 147), ...newLines, ...lines.slice(166)];
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Done!');
