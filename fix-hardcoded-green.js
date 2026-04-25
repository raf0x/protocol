const fs = require('fs');

const files = [
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/community/page.tsx',
  'app/profile/page.tsx',
  'app/calculator/page.tsx',
  'app/protocol/manage/page.tsx',
  'app/page.tsx',
  'components/BottomNav.tsx',
];

let totalFixed = 0;
files.forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');
  const before = (content.match(/#39ff14/g) || []).length;

  // Replace all remaining hardcoded neon green
  content = content.split("'#39ff14'").join("'var(--color-green)'");
  content = content.split('"#39ff14"').join('"var(--color-green)"');
  content = content.split('#39ff14').join('var(--color-green)');

  const after = (content.match(/#39ff14/g) || []).length;
  totalFixed += (before - after);
  fs.writeFileSync(filepath, content, 'utf8');
  console.log(filepath + ': fixed ' + (before - after) + ' instances');
});

console.log('Total fixed: ' + totalFixed);
