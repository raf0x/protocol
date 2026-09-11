const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `type DueCompound = { id: string; name: string; dose: string; dose_unit: string; volume_ml: number; syringe_units: number; time_of_day: string; protocol_name: string }`,
  `type DueCompound = { id: string; name: string; dose: string; dose_unit: string; volume_ml: number; syringe_units: number; time_of_day: string; protocol_name: string; start_date?: string; frequency?: string; day_of_week?: number | null }`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
