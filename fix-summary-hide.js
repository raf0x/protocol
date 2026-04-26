const fs = require('fs');
let component = fs.readFileSync('components/dashboard/WeeklySummary.tsx', 'utf8');

component = component.replace(
  `  const isSunday = today.getDay() === 0
  if ((!isSunday && !forceShow) || (isSunday && forceShow === false) || entries.length < 3) return null`,
  `  const isSunday = today.getDay() === 0
  const shouldShow = forceShow !== undefined ? forceShow : isSunday
  if (!shouldShow || entries.length < 3) return null`
);

fs.writeFileSync('components/dashboard/WeeklySummary.tsx', component, 'utf8');
console.log('Done!');
