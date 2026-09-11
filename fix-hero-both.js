const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Fix 1: Light mode compatible colors - replace all hardcoded dark colors
content = content.split("background:'linear-gradient(135deg, #111111 0%, #1a1a2e 100%)'").join("background:'var(--color-surface)'");
content = content.split("fill='#0d0d1a'").join("fill='var(--color-card)'");
content = content.split("fill='#1a1a2e'").join("fill='var(--color-card)'");
content = content.split("border:'1px solid rgba(255,255,255,0.08)'").join("border:'1px solid var(--color-border)'");
content = content.split("color:'rgba(255,255,255,0.4)'").join("color:'var(--color-muted)'");
content = content.split("color:'rgba(255,255,255,0.5)'").join("color:'var(--color-dim)'");
content = content.split("color:'rgba(255,255,255,0.8)'").join("color:'var(--color-text)'");
content = content.split("color:'rgba(255,255,255,0.75)'").join("color:'var(--color-text)'");
content = content.split("color:'rgba(255,255,255,0.3)'").join("color:'var(--color-muted)'");
content = content.split("fill='rgba(255,255,255,0.07)'").join("fill='rgba(128,128,128,0.1)'");
content = content.split("fill='rgba(255,255,255,0.06)'").join("fill='rgba(128,128,128,0.08)'");
content = content.split("fill='rgba(255,255,255,0.04)'").join("fill='rgba(128,128,128,0.06)'");
content = content.split("fill='rgba(255,255,255,0.12)'").join("fill='rgba(128,128,128,0.12)'");
content = content.split("background:'rgba(255,255,255,0.08)'").join("background:'var(--color-border)'");
content = content.split("background:'rgba(255,255,255,0.06)'").join("background:'var(--color-surface)'");
content = content.split("border:'1px solid rgba(255,255,255,0.1)'").join("border:'1px solid var(--color-border)'");
content = content.split("border:'1px solid rgba(255,255,255,0.15)'").join("border:'1px solid var(--color-border)'");
content = content.split("borderTop:'1px solid rgba(255,255,255,0.08)'").join("borderTop:'1px solid var(--color-border)'");
content = content.split("borderTop:'1px solid rgba(255,255,255,0.1)'").join("borderTop:'1px solid var(--color-border)'");
content = content.split("color:'white'").join("color:'var(--color-text)'");
content = content.split('fill="white"').join('fill="var(--color-text)"');
content = content.split("fill='rgba(255,255,255,0.4)'").join("fill='rgba(128,128,128,0.5)'");
content = content.split("stopColor='white'").join("stopColor='var(--color-text)'");

// Fix 2: IU dose mL calculation - use concentration math not /100
content = content.replace(
  `    const mlPerDose = currentPhase.dose_unit === 'IU'
    ? currentPhase.dose / 100
    : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)`,
  `    // All doses use concentration math: mL = dose / concentration
    // For IU: concentration = vial_strength_IU / bac_water_ml
    // For mg: concentration = (vial_strength_mg * 1000) / bac_water_ml (in mcg/mL)
    const mlPerDose = currentPhase.dose_unit === 'IU' && vialStrength > 0 && bacWater > 0
      ? currentPhase.dose / (vialStrength / bacWater)
      : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Done!');
