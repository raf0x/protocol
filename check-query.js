const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('compounds(') || line.includes('phases(')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
