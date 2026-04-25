const fs = require('fs');

const files = [
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/community/page.tsx',
  'app/profile/page.tsx',
  'app/calculator/page.tsx',
  'app/protocol/manage/page.tsx',
  'components/BottomNav.tsx',
];

files.forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('color-green') && (line.includes('background') || line.includes('bg'))) {
      console.log(filepath + ':' + (i+1) + ': ' + line.trim().slice(0,120));
    }
    if ((line.includes("'#000'") || line.includes("'#000000'")) ) {
      console.log(filepath + ':' + (i+1) + ': ' + line.trim().slice(0,120));
    }
  });
});
