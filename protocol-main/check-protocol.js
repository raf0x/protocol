const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');
// Show lines around the stats section
lines.forEach((line, i) => {
  if (i >= 195 && i <= 260) console.log((i+1) + ': ' + line);
});
