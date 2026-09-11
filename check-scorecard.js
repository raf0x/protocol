const fs = require('fs');
const content = fs.readFileSync('components/dashboard/DailyLogCard.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('ScoreBtn') || line.includes('scoreColors') || line.includes('activeColor')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
