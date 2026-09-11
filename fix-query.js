const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name)`,
  `phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name, time_of_day)`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('time_of_day') ? 'yes' : 'NO'));
