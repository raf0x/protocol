const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
content = content.replace(
  `<VialInventory compoundId={activeCompound.id} compoundName={activeCompound.name} />`,
  `<VialInventory compoundId={activeCompound.id} compoundName={activeCompound.name} reconstitutionDate={activeCompound.reconstitution_date} bacWaterMl={activeCompound.bac_water_ml} />`
);
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Done!');
