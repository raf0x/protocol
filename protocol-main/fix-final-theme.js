const fs = require('fs');

// Fix 1: VialInventory Edit buttons
let inv = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const invLines = inv.split('\n');

// Line 267 - Edit vials in stock button
invLines[266] = invLines[266]
  .replace("background:'var(--color-surface)'", "background:'var(--color-card)'")
  .replace(/color:'var\(--color-[a-z]+\)'/, "color:'var(--color-text)'");

// Line 285 - Edit doses button  
invLines[284] = invLines[284]
  .replace("background:'var(--color-surface)'", "background:'var(--color-card)'")
  .replace(/color:'var\(--color-[a-z]+\)'/, "color:'var(--color-text)'");

fs.writeFileSync('components/dashboard/VialInventory.tsx', invLines.join('\n'), 'utf8');
console.log('VialInventory Edit buttons fixed');

// Fix 2: TodaysInjections row backgrounds
let inj = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
const injLines = inj.split('\n');

// Line 91 - injection row
injLines[90] = injLines[90]
  .replace("background:taken?'var(--color-green-05)':'rgba(160,40,40,0.06)'", "background:taken?'var(--color-green-05)':'var(--color-card)'")
  .replace("border:'1px solid '+(taken?'var(--color-green-30)':'rgba(200,70,70,0.25)')", "border:'1px solid '+(taken?'var(--color-green-30)':'var(--color-border)')");

fs.writeFileSync('components/dashboard/TodaysInjections.tsx', injLines.join('\n'), 'utf8');
console.log('TodaysInjections rows fixed');
