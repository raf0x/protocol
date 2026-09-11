const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name, time_of_day)`,
  `phases(dose, dose_unit, frequency, day_of_week, days_of_week, start_week, end_week, name, time_of_day)`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('days_of_week') ? 'yes' : 'NO'));
