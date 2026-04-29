const fs = require('fs');

['app/protocol/page.tsx', 'components/dashboard/DailyLogCard.tsx', 'app/journal/page.tsx'].forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.split(
    `current={hunger} onChange={setHunger} />`
  ).join(
    `current={hunger} onChange={setHunger} reverse />`
  );
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Done: ' + filepath);
});
