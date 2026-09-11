const fs = require('fs');

// Fix 1: HeroProtocolCard - VialInventory section hardcoded white colors
let hero = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// These are in the inline vial inventory section inside hero card
hero = hero.split("color:'rgba(255,255,255,0.3)',fontWeight:'700',letterSpacing:'1px',display:'block',marginBottom:'2px'").join("color:'var(--color-muted)',fontWeight:'700',letterSpacing:'1px',display:'block',marginBottom:'2px'");
hero = hero.split("color:'rgba(255,255,255,0.8)',fontWeight:'700'").join("color:'var(--color-text)',fontWeight:'700'");
hero = hero.split("color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'white'").join("color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'var(--color-text)'");

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', hero, 'utf8');
console.log('Hero card fixed');

// Fix 2: VialInventory - all hardcoded rgba white colors
let inv = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
inv = inv.split("color:'rgba(255,255,255,0.3)'").join("color:'var(--color-muted)'");
inv = inv.split("color:'rgba(255,255,255,0.8)'").join("color:'var(--color-text)'");
inv = inv.split("color:'rgba(255,255,255,0.5)'").join("color:'var(--color-dim)'");
inv = inv.split("color:'rgba(255,255,255,0.4)'").join("color:'var(--color-dim)'");
inv = inv.split("background:'rgba(255,255,255,0.06)'").join("background:'var(--color-surface)'");
inv = inv.split("border:'1px solid rgba(255,255,255,0.1)'").join("border:'1px solid var(--color-border)'");
inv = inv.split("border:'1px solid rgba(255,255,255,0.15)'").join("border:'1px solid var(--color-border)'");
inv = inv.split("borderTop:'1px solid rgba(255,255,255,0.1)'").join("borderTop:'1px solid var(--color-border)'");
inv = inv.split("borderTop:'1px solid rgba(255,255,255,0.08)'").join("borderTop:'1px solid var(--color-border)'");
inv = inv.split("color:'white'").join("color:'var(--color-text)'");
inv = inv.split("background:'rgba(57,255,20,0.1)'").join("background:'var(--color-green-10)'");
inv = inv.split("border:'1px solid rgba(57,255,20,0.3)'").join("border:'1px solid var(--color-green-30)'");
fs.writeFileSync('components/dashboard/VialInventory.tsx', inv, 'utf8');
console.log('VialInventory fixed');

// Fix 3: TodaysInjections - compound names and time labels
let inj = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
inj = inj.split("color:'var(--color-dim)',fontSize:'10px',fontWeight:'700'").join("color:'var(--color-text)',fontSize:'10px',fontWeight:'700'");
// Time label badge - make it visible
inj = inj.replace(
  `<span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-dim)',background:'var(--color-surface)',padding:'2px 5px',borderRadius:'4px'}}>{timeLabel}</span>`,
  `<span style={{fontSize:'10px',fontWeight:'800',color:'var(--color-text)',background:'var(--color-border)',padding:'3px 7px',borderRadius:'4px'}}>{timeLabel}</span>`
);
// Dose text
inj = inj.replace(
  `<span style={{fontSize:'12px',color:'var(--color-dim)'}}>{c.dose}{c.dose_unit}</span>`,
  `<span style={{fontSize:'12px',color:'var(--color-text)',fontWeight:'600'}}>{c.dose}{c.dose_unit}</span>`
);
// Compound name when not taken
inj = inj.replace(
  `color:taken?'var(--color-dim)':'var(--color-text)',textDecoration:taken?'line-through':'none'`,
  `color:taken?'var(--color-muted)':'var(--color-text)',fontWeight:'700',textDecoration:taken?'line-through':'none'`
);
fs.writeFileSync('components/dashboard/TodaysInjections.tsx', inj, 'utf8');
console.log('TodaysInjections fixed');
