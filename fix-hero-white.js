const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Replace dark gradient background with theme-aware card
content = content.replace(
  `background:'linear-gradient(135deg, #111111 0%, #1a1a2e 100%)'`,
  `background:'var(--color-card)'`
);

// Replace all hardcoded white/rgba white colors with theme vars
content = content.split("color:'#ffffff'").join("color:'var(--color-text)'");
content = content.split("color:'white'").join("color:'var(--color-text)'");
content = content.split("color:'rgba(255,255,255,0.95)'").join("color:'var(--color-text)'");
content = content.split("color:'rgba(255,255,255,0.9)'").join("color:'var(--color-text)'");
content = content.split("color:'rgba(255,255,255,0.85)'").join("color:'var(--color-dim)'");
content = content.split("color:'rgba(255,255,255,0.75)'").join("color:'var(--color-dim)'");
content = content.split("color:'rgba(255,255,255,0.7)'").join("color:'var(--color-dim)'");
content = content.split("color:'rgba(255,255,255,0.65)'").join("color:'var(--color-dim)'");
content = content.split("color:'rgba(255,255,255,0.6)'").join("color:'var(--color-dim)'");
content = content.split("color:'rgba(255,255,255,0.5)'").join("color:'var(--color-muted)'");
content = content.split("color:'rgba(255,255,255,0.4)'").join("color:'var(--color-muted)'");
content = content.split("color:'rgba(255,255,255,0.3)'").join("color:'var(--color-muted)'");
content = content.split("fill='white'").join("fill='var(--color-text)'");
content = content.split("fill='rgba(255,255,255,0.4)'").join("fill='var(--color-muted)'");
content = content.split("fill='rgba(128,128,128,0.1)'").join("fill='var(--color-border)'");
content = content.split("fill='rgba(128,128,128,0.08)'").join("fill='var(--color-surface)'");
content = content.split("fill='rgba(128,128,128,0.06)'").join("fill='transparent'");
content = content.split("fill='rgba(128,128,128,0.12)'").join("fill='var(--color-border)'");
content = content.split("background:'rgba(255,255,255,0.25)'").join("background:'var(--color-border)'");
content = content.split("background:'rgba(255,255,255,0.08)'").join("background:'var(--color-border)'");
content = content.split("border:'1px solid rgba(255,255,255,0.08)'").join("border:'1px solid var(--color-border)'");
content = content.split("borderTop:'1px solid rgba(255,255,255,0.1)'").join("borderTop:'1px solid var(--color-border)'");
content = content.split("borderTop:'1px solid rgba(255,255,255,0.08)'").join("borderTop:'1px solid var(--color-border)'");
content = content.split("background:'rgba(255,255,255,0.06)'").join("background:'var(--color-surface)'");
content = content.split("border:'1px solid rgba(255,255,255,0.1)'").join("border:'1px solid var(--color-border)'");
content = content.split("border:'1px solid rgba(255,255,255,0.15)'").join("border:'1px solid var(--color-border)'");
content = content.split("fill='#0d0d1a'").join("fill='var(--color-input)'");
content = content.split("fill='var(--color-card)'").join("fill='var(--color-input)'");

// Fix vial % text - black on light, white on dark based on theme
content = content.replace(
  `fill={fill > 0.4 ? '#000000' : 'white'}`,
  `fill='var(--color-text)'`
);

// Fix progress bar glow 
content = content.replace(
  `position:'absolute',top:'-20px',right:'-20px',width:'140px',height:'140px',borderRadius:'50%',background:color.replace('#','rgba(') + ',0.06)',filter:'blur(40px)',pointerEvents:'none'`,
  `position:'absolute',top:'-20px',right:'-20px',width:'140px',height:'140px',borderRadius:'50%',background:color.replace('#','rgba(') + ',0.08)',filter:'blur(40px)',pointerEvents:'none'`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Done!');
