const fs = require('fs');
let content = fs.readFileSync('components/dashboard/WeeklySchedule.tsx', 'utf8');

// Future dates should never show as logged even if DB has an entry
content = content.replace(
  `  const isLogged = !!logs[compound.id + '_' + dateStr]`,
  `  const isLogged = !!logs[compound.id + '_' + dateStr] && !isFuture`
);

fs.writeFileSync('components/dashboard/WeeklySchedule.tsx', content, 'utf8');
console.log('Done!');
