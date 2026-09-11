const fs = require('fs');
try {
  fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', "'use client'\n// placeholder\nexport default function HeroProtocolCard() { return null }\n", 'utf8');
  console.log('Created:', fs.existsSync('components/dashboard/HeroProtocolCard.tsx'));
} catch(e) {
  console.log('ERROR:', e.message);
}
