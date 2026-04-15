const fs = require('fs');

const pages = [
  'app/calculator/page.tsx',
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/learn/page.tsx',
  'app/profile/page.tsx',
  'app/community/page.tsx',
  'app/auth/login/page.tsx',
  'app/onboarding/page.tsx',
  'app/admin/page.tsx',
];

pages.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  content = content
    .replace(/const bg = '#000000'/g, "const bg = '#0a0a0f'")
    .replace(/const g = '#39ff14'/g, "const g = '#39ff14'")
    .replace(/const dg = '#4dbd4d'/g, "const dg = '#8b8ba7'")
    .replace(/const mg = '#2d5a2d'/g, "const mg = '#3d3d5c'")
    .replace(/const cb = '#0d0d0d'/g, "const cb = '#12121a'")
    .replace(/const bd = '#1a1a1a'/g, "const bd = '#1e1e2e'")
    .replace(/background:'#000000'/g, "background:'#0a0a0f'")
    .replace(/background:'#030712'/g, "background:'#0a0a0f'")
    .replace(/background:'#0d0d0d'/g, "background:'#12121a'")
    .replace(/background:'#111827'/g, "background:'#12121a'")
    .replace(/'1px solid #1a1a1a'/g, "'1px solid #1e1e2e'")
    .replace(/'1px solid #1f2937'/g, "'1px solid #1e1e2e'")
    .replace(/color:'#4dbd4d'/g, "color:'#8b8ba7'")
    .replace(/color:'#2d5a2d'/g, "color:'#3d3d5c'")
    .replace(/'#2563eb'/g, "'#6c63ff'")
    .replace(/'#1d4ed8'/g, "'#5549e8'")
    .replace(/'#3b82f6'/g, "'#6c63ff'")
    .replace(/'#1f2937'/g, "'#12121a'")
    .replace(/'#374151'/g, "'#1e1e2e'");
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated:', filePath);
});

console.log('All done');
