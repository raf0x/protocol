const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Brighten the list view subtitle (Week / Started / compounds)
content = content.replace(
  "                  <p style={{fontSize:'12px',color:mg}}>Week {currentWeek}{currentPhase ? ' · ' + currentPhase.dose + currentPhase.dose_unit : ''}{compoundCount > 1 ? ' · ' + compoundCount + ' compounds' : ''}</p>",
  "                  <p style={{fontSize:'12px',color:dg,fontWeight:'500'}}>Week {currentWeek}{currentPhase ? ' · ' + currentPhase.dose + currentPhase.dose_unit : ''}{compoundCount > 1 ? ' · ' + compoundCount + ' compounds' : ''}</p>"
);

// Brighten the detail view subtitle (Week / Started date)
content = content.replace(
  "                    <p style={{fontSize:'12px',color:mg,marginTop:'2px'}}>Week {currentWeek} · Started {new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>",
  "                    <p style={{fontSize:'12px',color:dg,fontWeight:'500',marginTop:'2px'}}>Week {currentWeek} · Started {new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>"
);

// Brighten the vial/BAC info in detail view
content = content.replace(
  "                      {c.vial_strength && <span style={{fontSize:'11px',color:mg}}>{c.vial_strength}{c.vial_unit} vial · {c.bac_water_ml || '?'}mL BAC</span>}",
  "                      {c.vial_strength && <span style={{fontSize:'11px',color:dg,fontWeight:'500'}}>{c.vial_strength}{c.vial_unit} vial · {c.bac_water_ml || '?'}mL BAC</span>}"
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
