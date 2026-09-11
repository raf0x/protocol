const fs = require('fs');
const content = fs.readFileSync('app/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Get early access') || line.includes('See it')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
