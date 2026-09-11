const fs = require('fs');
let content = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
content = content.replace(
  `  start_date: string
  frequency: string
  day_of_week: number | null`,
  `  start_date?: string
  frequency?: string
  day_of_week?: number | null`
);
fs.writeFileSync('components/dashboard/TodaysInjections.tsx', content, 'utf8');
console.log('Done!');
