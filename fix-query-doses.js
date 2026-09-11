const fs = require('fs');

// Fix 1: Add doses_taken_override to the compounds query
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');
protocol = protocol.replace(
  `compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name, time_of_day))`,
  `compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, doses_taken_override, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name, time_of_day))`
);
fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('Query fixed');

// Fix 2: Use doses_taken_override directly from compound data in hero card
let hero = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = hero.split('\n');
lines.forEach((line, i) => {
  if (line.includes('localStorage') || line.includes('_refresh') || line.includes('totalDosesTaken') || line.includes('override')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 100));
  }
});
