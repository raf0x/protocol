const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

content = content.replace(
  "text: `Your average mood is ${avgMood.toFixed(1)}/5`",
  "text: `Mood trend: averaging ${avgMood.toFixed(1)}/5 — ${avgMood >= 4 ? 'strong' : avgMood >= 3 ? 'stable' : 'review your recent changes'}`"
);

content = content.replace(
  "text: `Averaging ${avgSleep.toFixed(1)} hours of sleep this week`",
  "text: `Sleep: ${avgSleep.toFixed(1)} hrs avg this week — ${avgSleep >= 7.5 ? 'recovery on track' : avgSleep >= 6 ? 'watch for decline' : 'sleep quality needs attention'}`"
);

content = content.replace(
  "text: `Hunger averaging ${avgHunger.toFixed(1)}/5 — appetite suppression working`",
  "text: `Appetite: suppressed (${avgHunger.toFixed(1)}/5) — protocol is delivering`"
);

content = content.replace(
  "text: `Hunger trending high (${avgHunger.toFixed(1)}/5) — worth noting`",
  "text: `Appetite: elevated (${avgHunger.toFixed(1)}/5) — track closely this week`"
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
