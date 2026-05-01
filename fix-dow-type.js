const fs = require('fs');
let content = fs.readFileSync('lib/utils.ts', 'utf8');

content = content.replace(
  `  if (daysOfWeek && daysOfWeek.length > 0) return daysOfWeek.includes(todayDay)`,
  `  if (daysOfWeek && daysOfWeek.length > 0) return daysOfWeek.map(Number).includes(todayDay)`
);

fs.writeFileSync('lib/utils.ts', content, 'utf8');
console.log('Done!');
