const fs = require('fs');
const content = fs.readFileSync('components/dashboard/DailyLogCard.tsx', 'utf8');
const lines = content.split('\n');
lines.slice(20, 35).forEach((line, i) => console.log((i+21) + ': ' + line));
