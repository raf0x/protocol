const fs = require('fs');

['app/protocol/page.tsx', 'components/dashboard/DailyLogCard.tsx', 'app/journal/page.tsx'].forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');
  // Add reverse prop to hunger ScoreBtn calls
  content = content.replace(
    /\{[1,2,3,4,5\]\.map\(v => <ScoreBtn key=\{v\} value=\{v\} current=\{hunger\} onChange=\{setHunger\}/g,
    `{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={hunger} onChange={setHunger} reverse`
  );
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Hunger reversed: ' + filepath);
});
