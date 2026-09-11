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

files.forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');
  const before = content.length;

  // Fix rgba versions of neon green
  content = content.split("rgba(57,255,20,0.1)").join("var(--color-green-10)");
  content = content.split("rgba(57,255,20,0.12)").join("var(--color-green-10)");
  content = content.split("rgba(57,255,20,0.15)").join("var(--color-green-15)");
  content = content.split("rgba(57,255,20,0.2)").join("var(--color-green-20)");
  content = content.split("rgba(57,255,20,0.3)").join("var(--color-green-30)");
  content = content.split("rgba(57,255,20,0.4)").join("var(--color-green-40)");
  content = content.split("rgba(57,255,20,0.5)").join("var(--color-green-50)");
  content = content.split("rgba(57,255,20,0.6)").join("var(--color-green-60)");
  content = content.split("'rgba(57,255,20,0.05)'").join("'var(--color-green-05)'");

  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Fixed rgba in: ' + filepath);
});
