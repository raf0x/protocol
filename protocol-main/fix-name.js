const fs = require('fs');
let content = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
content = content.replace(
  `{c.dose}{c.dose_unit} \u00b7 {c.protocol_name}`,
  `{c.dose}{c.dose_unit}`
);
fs.writeFileSync('components/dashboard/TodaysInjections.tsx', content, 'utf8');
console.log('Done!');
