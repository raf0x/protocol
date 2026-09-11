const fs = require('fs');
const content = fs.readFileSync('lib/utils.ts', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (i < 35) console.log((i+1) + ': ' + line);
});
