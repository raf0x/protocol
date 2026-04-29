const fs = require('fs');
const j = fs.readFileSync('app/journal/page.tsx', 'utf8');
if (j.includes('activeColor')) {
  console.log('Journal has activeColor - needs fixing');
} else {
  console.log('Journal OK');
}
