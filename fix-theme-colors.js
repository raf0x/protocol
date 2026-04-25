const fs = require('fs');

const files = [
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/community/page.tsx',
  'app/profile/page.tsx',
  'app/calculator/page.tsx',
  'app/protocol/manage/page.tsx',
  'app/page.tsx',
];

const replacements = [
  ["const g = '#39ff14'", "const g = 'var(--color-green)'"],
  ["const dg = '#8b8ba7'", "const dg = 'var(--color-dim)'"],
  ["const mg = '#3d3d5c'", "const mg = 'var(--color-muted)'"],
  ["const cb = '#12121a'", "const cb = 'var(--color-card)'"],
  ["const bd = '#1e1e2e'", "const bd = 'var(--color-border)'"],
  ["g = '#39ff14', dg = '#8b8ba7', mg = '#3d3d5c', cb = '#12121a', bd = '#1e1e2e'",
   "g = 'var(--color-green)', dg = 'var(--color-dim)', mg = 'var(--color-muted)', cb = 'var(--color-card)', bd = 'var(--color-border)'"],
  ["background:'#0a0a0f'", "background:'var(--color-bg)'"],
  ["background:'#0c0c14'", "background:'var(--color-bg)'"],
  ["background:'#12121a'", "background:'var(--color-card)'"],
  ["background:'#1a1a2e'", "background:'var(--color-surface)'"],
  ["background:'rgba(10,10,15,0.9)'", "background:'var(--color-nav-blur)'"],
  ["color:'white'", "color:'var(--color-text)'"],
  ["color:'#ffffff'", "color:'var(--color-text)'"],
  ["'1px solid #1e1e2e'", "'1px solid var(--color-border)'"],
];

files.forEach(filepath => {
  if (!fs.existsSync(filepath)) { console.log('SKIP:', filepath); return; }
  let content = fs.readFileSync(filepath, 'utf8');
  replacements.forEach(([find, replace]) => {
    content = content.split(find).join(replace);
  });
  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Updated:', filepath);
});
console.log('All done!');
