const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');
content = content.replace(
  "<Line type='monotone' dataKey='sleep' stroke='#7fff7f' strokeWidth={2} dot={false} name='Sleep (hrs)' />",
  "<Line type='monotone' dataKey='sleep' stroke='#06b6d4' strokeWidth={2} dot={false} name='Sleep (hrs)' />"
);
content = content.replace(
  "<Line type='monotone' dataKey='energy' stroke='#f59e0b' strokeWidth={2} dot={false} name='Energy' />",
  "<Line type='monotone' dataKey='energy' stroke='#f97316' strokeWidth={2} dot={false} name='Energy' />"
);
fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
