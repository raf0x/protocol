const fs = require('fs');
const content = fs.readFileSync('app/journal/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('ScoreBtn') || line.includes('activeColor')) {
    console.log((i+1) + ': ' + line.trim());
  }
});
