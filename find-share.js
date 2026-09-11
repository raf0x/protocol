const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('CompoundNotes') || line.includes('shareProtocol') || line.includes('Share protocol')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
