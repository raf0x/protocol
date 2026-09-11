const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

const newProgressLines = [
"  // Protocol progress - dose based if override exists, otherwise time based",
"  let totalDosesEstimate = 0",
"  try {",
"    const override = localStorage.getItem('vial_inventory_' + activeCompound.id + '_doses')",
"    const allPhases = (activeCompound.phases || []).sort((a: any, b: any) => a.start_week - b.start_week)",
"    // Estimate total doses from phase timeline",
"    for (const ph of allPhases) {",
"      const phaseWeeks = ph.end_week - ph.start_week + 1",
"      const dosesPerWeek = ph.frequency === 'daily' ? 7 : ph.frequency === 'eod' ? 3.5 : ph.frequency === 'every3days' ? 2.3 : ph.frequency === '1x/week' ? 1 : ph.frequency === '2x/week' ? 2 : ph.frequency === '3x/week' ? 3 : ph.frequency === '4x/week' ? 4 : ph.frequency === '5x/week' ? 5 : 2",
"      totalDosesEstimate += phaseWeeks * dosesPerWeek",
"    }",
"    if (override !== null && totalDosesEstimate > 0) {",
"      const taken = parseInt(override)",
"      var progress = Math.min(100, Math.round((taken / totalDosesEstimate) * 100))",
"    } else {",
"      const lastPhase2 = (activeCompound.phases || []).sort((a: any, b: any) => b.end_week - a.end_week)[0]",
"      const totalDays2 = lastPhase2 ? lastPhase2.end_week * 7 : 84",
"      var progress = Math.min(100, Math.round((daysIn / totalDays2) * 100))",
"    }",
"  } catch(e) {",
"    const lastPhase3 = (activeCompound.phases || []).sort((a: any, b: any) => b.end_week - a.end_week)[0]",
"    const totalDays3 = lastPhase3 ? lastPhase3.end_week * 7 : 84",
"    var progress = Math.min(100, Math.round((daysIn / totalDays3) * 100))",
"  }",
];

// Replace lines 109-113 (0-indexed 108-112)
const result = [...lines.slice(0, 108), ...newProgressLines, ...lines.slice(113)];
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Done!');
