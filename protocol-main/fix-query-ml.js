const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, doses_taken_override, phases(`,
  `compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, doses_taken_override, ml_per_dose, phases(`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Query updated: ' + (content.includes('ml_per_dose') ? 'yes' : 'NO'));
