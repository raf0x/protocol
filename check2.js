const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (i >= 208 && i <= 255) console.log((i+1) + ': ' + line);
});
