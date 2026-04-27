const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add import
content = content.replace(
  `import VialInventory from '../../components/dashboard/VialInventory'`,
  `import VialInventory from '../../components/dashboard/VialInventory'
import TodaysInjections from '../../components/dashboard/TodaysInjections'`
);

// Update DueCompound type to include new fields
content = content.replace(
  `type DueCompound = { id: string; name: string; dose: string; protocol_name: string }`,
  `type DueCompound = { id: string; name: string; dose: string; dose_unit: string; volume_ml: number; syringe_units: number; time_of_day: string; protocol_name: string }`
);

// Update the due compounds builder to include new fields
content = content.replace(
  `if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week)) due.push({ id: c.id, name: c.name, dose: phase.dose+phase.dose_unit, protocol_name: p.name })`,
  `if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week)) {
          const concentration = c.vial_strength && c.bac_water_ml ? (c.vial_strength * 1000) / c.bac_water_ml : 0
          const volumeMl = concentration > 0 ? (phase.dose * 1000) / concentration : 0
          const syringeUnits = volumeMl * 100
          due.push({
            id: c.id,
            name: c.name,
            dose: phase.dose,
            dose_unit: phase.dose_unit || 'mg',
            volume_ml: volumeMl,
            syringe_units: syringeUnits,
            time_of_day: phase.time_of_day || 'morning',
            protocol_name: p.name
          })
        }`
);

// Add TodaysInjections card right after StatsBar, before weekly summary
content = content.replace(
  `        {/* Weekly summary — Sundays only */}`,
  `        {/* Today's injections — always visible */}
        <TodaysInjections
          dueCompounds={dueCompounds}
          logs={logs}
          onToggle={toggleInjection}
          onDiscomfort={setDiscomfortVal}
        />

        {/* Weekly summary — Sundays only */}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
