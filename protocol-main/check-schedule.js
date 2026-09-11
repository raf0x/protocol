const fs = require('fs');
const content = fs.readFileSync('components/dashboard/WeeklySchedule.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('isDueToday') || line.includes('isDueOnDate') || line.includes('days_of_week')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
