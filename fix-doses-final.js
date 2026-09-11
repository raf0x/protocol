const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

// Replace lines 112-135 (progress block) - 0-indexed 111-134
const newProgressLines = [
"  // Protocol progress - dose based if override exists, otherwise time based",
"  let totalDosesEstimate = 0",
"  const dosesOverride = activeCompound.doses_taken_override ?? null",
"  const allPhases = (activeCompound.phases || []).sort((a: any, b: any) => a.start_week - b.start_week)",
"  for (const ph of allPhases) {",
"    const phaseWeeks = ph.end_week - ph.start_week + 1",
"    const dosesPerWeek = ph.frequency === 'daily' ? 7 : ph.frequency === 'eod' ? 3.5 : ph.frequency === 'every3days' ? 2.3 : ph.frequency === '1x/week' ? 1 : ph.frequency === '2x/week' ? 2 : ph.frequency === '3x/week' ? 3 : ph.frequency === '4x/week' ? 4 : ph.frequency === '5x/week' ? 5 : 2",
"    totalDosesEstimate += phaseWeeks * dosesPerWeek",
"  }",
"  const lastPhaseForProgress = (activeCompound.phases || []).sort((a: any, b: any) => b.end_week - a.end_week)[0]",
"  const totalDaysForProgress = lastPhaseForProgress ? lastPhaseForProgress.end_week * 7 : 84",
"  const progress = dosesOverride !== null && totalDosesEstimate > 0",
"    ? Math.min(100, Math.round((dosesOverride / totalDosesEstimate) * 100))",
"    : Math.min(100, Math.round((daysIn / totalDaysForProgress) * 100))",
];

// Replace lines 152-164 (vial fill block) - 0-indexed 151-163
const newVialLines = [
"  // Use doses_taken_override from Supabase directly - no localStorage",
"  const totalDosesTaken = dosesOverride !== null",
"    ? dosesOverride",
"    : allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken).length",
];

// Do replacements from bottom to top so line numbers don't shift
let result = lines.slice()

// Replace vial lines 152-164 first (higher line numbers)
result = [...result.slice(0, 151), ...newVialLines, ...result.slice(164)]

// Now replace progress lines 112-135 (adjust for line count change)
const lineDiff = newVialLines.length - 13 // 3 new lines replacing 13
result = [...result.slice(0, 111), ...newProgressLines, ...result.slice(135 + lineDiff)]

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', result.join('\n'), 'utf8');
console.log('Done!');
