const fs = require('fs');
const content = fs.readFileSync('app/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (i >= 140 && i <= 165) console.log((i+1) + ': ' + line.trim().slice(0, 120));
});
