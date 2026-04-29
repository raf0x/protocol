const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

content = content.replace(
  `function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) {`,
  `function ScoreBtn({ value, current, onChange, reverse }: { value: number; current: number | null; onChange: (v: number) => void; reverse?: boolean }) {`
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done!');
