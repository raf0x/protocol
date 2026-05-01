const fs = require('fs');
let content = fs.readFileSync('lib/utils.ts', 'utf8');

// Replace the hardcoded 3x/4x/5x/6x week fallbacks with a note
// If days_of_week is empty and frequency is Nx/week, return false so the user knows to set their schedule
content = content.replace(
  `  if (frequency === '3x/week') return todayDay === 1 || todayDay === 3 || todayDay === 5
  if (frequency === '4x/week') return todayDay === 1 || todayDay === 2 || todayDay === 4 || todayDay === 5
  if (frequency === '5x/week') return todayDay >= 1 && todayDay <= 5
  if (frequency === '6x/week') return todayDay !== 0`,
  `  // For Nx/week without days_of_week set, return false — user needs to set their schedule
  // This prevents wrong days showing up from hardcoded assumptions
  if (frequency === '3x/week') return false
  if (frequency === '4x/week') return false
  if (frequency === '5x/week') return todayDay >= 1 && todayDay <= 5 // weekdays is safe assumption
  if (frequency === '6x/week') return todayDay !== 0 // every day except sunday is safe`
);

fs.writeFileSync('lib/utils.ts', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('user needs to set') ? 'yes' : 'NO'));
