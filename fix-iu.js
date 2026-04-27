const fs = require('fs');
let content = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');

// Remove IU and mL from display — dose+unit is enough
content = content.replace(
  `                    <span style={{fontSize:'12px',color:'var(--color-muted)'}}>
                      {c.dose}{c.dose_unit}
                      {c.syringe_units > 0 ? ' \u00b7 ' + c.syringe_units.toFixed(0) + ' IU' : ''}
                      {c.volume_ml > 0 ? ' \u00b7 ' + c.volume_ml.toFixed(2) + ' mL' : ''}
                    </span>`,
  `                    <span style={{fontSize:'12px',color:'var(--color-dim)'}}>
                      {c.dose}{c.dose_unit} \u00b7 {c.protocol_name}
                    </span>`
);

fs.writeFileSync('components/dashboard/TodaysInjections.tsx', content, 'utf8');
console.log('Done!');
