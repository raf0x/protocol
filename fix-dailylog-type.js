const fs = require('fs');
let content = fs.readFileSync('components/dashboard/DailyLogCard.tsx', 'utf8');

content = content.replace(
  `function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) {`,
  `function ScoreBtn({ value, current, onChange, reverse }: { value: number; current: number | null; onChange: (v: number) => void; reverse?: boolean }) {`
);

fs.writeFileSync('components/dashboard/DailyLogCard.tsx', content, 'utf8');
console.log('Done!');
