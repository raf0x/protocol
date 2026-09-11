const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Find the compound display in Active Compounds and add vial life
content = content.replace(
  "<div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}><span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{c.name}</span><span style={{fontSize:'12px',color:dg}}>{phase.dose}{phase.dose_unit} · {phase.frequency}</span></div>",
  `<div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}><span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{c.name}</span><span style={{fontSize:'12px',color:dg}}>{phase.dose}{phase.dose_unit} · {phase.frequency}</span></div>
                    {c.reconstitution_date && (() => { const rd = new Date(c.reconstitution_date+'T00:00:00'); const daysSince = Math.floor((Date.now()-rd.getTime())/86400000); const daysLeft = 28-daysSince; const pct = Math.min(100, Math.round((daysSince/28)*100)); return (<div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'6px'}}><span style={{fontSize:'10px',color:daysLeft<=5?'#ff6b6b':daysLeft<=10?'#f59e0b':dg}}>💉 Vial: {daysLeft > 0 ? daysLeft+'d left' : 'expired'} ({daysSince}d old)</span></div>) })()}`
);

// Also fetch reconstitution_date in the query
content = content.replace(
  "compounds(id, name, vial_strength, vial_unit, bac_water_ml, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name))",
  "compounds(id, name, vial_strength, vial_unit, bac_water_ml, reconstitution_date, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week, name))"
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
