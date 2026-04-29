const fs = require('fs');

// Fix 1: VialInventory mL PER DOSE Edit button - color-dim is too faint
let inv = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
inv = inv.replace(
  `color: mlPerDose === null ? '#f97316' : 'var(--color-dim)'`,
  `color: mlPerDose === null ? '#f97316' : 'var(--color-text)'`
);
inv = inv.replace(
  `'var(--color-surface)',border:'1px solid '+(mlPerDose === null ? 'rgba(249,115,22,0.4)' : 'var(--color-border)')`,
  `'var(--color-card)',border:'1px solid '+(mlPerDose === null ? 'rgba(249,115,22,0.4)' : 'var(--color-border)')`
);
fs.writeFileSync('components/dashboard/VialInventory.tsx', inv, 'utf8');
console.log('VialInventory fixed');

// Fix 2: TodaysInjections tomorrow rows - background is var(--color-surface) which is dark
// Line 91 - tomorrow rows need card background not surface
let inj = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
const injLines = inj.split('\n');
injLines[90] = injLines[90]
  .replace(
    `viewing==='today'?'rgba(160,40,40,0.06)':'var(--color-surface)'`,
    `viewing==='today'?'rgba(160,40,40,0.06)':'var(--color-card)'`
  )
  .replace(
    `viewing==='today'?'rgba(200,70,70,0.25)':'var(--color-border)'`,
    `viewing==='today'?'rgba(200,70,70,0.25)':'var(--color-border)'`
  );
fs.writeFileSync('components/dashboard/TodaysInjections.tsx', injLines.join('\n'), 'utf8');
console.log('TodaysInjections fixed');
