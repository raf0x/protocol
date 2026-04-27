const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
content = content.replace(
  `    const concentration = vialStrength > 0 ? (vialStrength * 1000) / bacWater : 0
    const mlPerDose = concentration > 0 ? (currentPhase.dose * 1000) / concentration : 0`,
  `    const mlPerDose = currentPhase.dose_unit === 'IU'
      ? currentPhase.dose / 100
      : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)`
);
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('IU math fixed:', content.includes("dose_unit === 'IU'") ? 'yes' : 'NO');
