const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Add weight projection insight after the weekly avg calculation
content = content.replace(
  "      if (weeksBetween >= 2) insights.push({ text: `Averaging ${(diff / weeksBetween).toFixed(1)} lbs lost per week`, accent: g })",
  "      if (weeksBetween >= 2) {\n        const weeklyRate = diff / weeksBetween\n        insights.push({ text: `Averaging ${weeklyRate.toFixed(1)} lbs lost per week`, accent: g })\n        const projected21 = latest.weight! - (weeklyRate * 3)\n        insights.push({ text: `At this rate: ${projected21.toFixed(0)} lbs in 3 weeks`, accent: '#6c63ff' })\n      }"
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
