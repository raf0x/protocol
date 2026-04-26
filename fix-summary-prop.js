const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `<WeeklySummary entries={entries} currentWeek={currentWeek} forceShow={showSummary} />`,
  `<WeeklySummary entries={entries} currentWeek={currentWeek} show={showSummary} />`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
