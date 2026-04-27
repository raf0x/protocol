const fs = require('fs');
let content = fs.readFileSync('app/protocol/manage/page.tsx', 'utf8');

// Add time_of_day to Phase type
content = content.replace(
  `type Phase = { name: string; dose: string; dose_unit: string; start_week: string; end_week: string; frequency: string; day_of_week: string }`,
  `type Phase = { name: string; dose: string; dose_unit: string; start_week: string; end_week: string; frequency: string; day_of_week: string; time_of_day: string }`
);

// Add time_of_day to newPhase()
content = content.replace(
  `function newPhase(): Phase { return { name: '', dose: '', dose_unit: 'mg', start_week: '1', end_week: '4', frequency: '1x/week', day_of_week: '0' } }`,
  `function newPhase(): Phase { return { name: '', dose: '', dose_unit: 'mg', start_week: '1', end_week: '4', frequency: '1x/week', day_of_week: '0', time_of_day: 'morning' } }`
);

// Add time_of_day when loading existing phases
content = content.replace(
  `frequency: ph.frequency || '1x/week', day_of_week: ph.day_of_week?.toString() || '0'`,
  `frequency: ph.frequency || '1x/week', day_of_week: ph.day_of_week?.toString() || '0', time_of_day: ph.time_of_day || 'morning'`
);

// Add time_of_day to the save rows
content = content.replace(
  `dose: parseFloat(ph.dose), dose_unit: ph.dose_unit, start_week: parseInt(ph.start_week)||1, end_week: parseInt(ph.end_week)||1, frequency: ph.frequency, day_of_week: (ph.frequency==='1x/week'||ph.frequency==='2x/week') ? parseInt(ph.day_of_week) : null, position: pi }))`,
  `dose: parseFloat(ph.dose), dose_unit: ph.dose_unit, start_week: parseInt(ph.start_week)||1, end_week: parseInt(ph.end_week)||1, frequency: ph.frequency, day_of_week: (ph.frequency==='1x/week'||ph.frequency==='2x/week') ? parseInt(ph.day_of_week) : null, time_of_day: ph.time_of_day || 'morning', position: pi }))` 
);

// Add time_of_day dropdown in the phase form UI — after frequency select
content = content.replace(
  `{(ph.frequency==='1x/week'||ph.frequency==='2x/week') && <select value={ph.day_of_week} onChange={e => updatePhase(ci,pi,'day_of_week',e.target.value)} style={ss}>{DAYS.map((d,i) => <option key={i} value={i}>Inject on {d}</option>)}</select>}`,
  `<label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',marginTop:'6px',fontWeight:'600'}}>TIME OF DAY</label>
                      <select value={ph.time_of_day} onChange={e => updatePhase(ci,pi,'time_of_day',e.target.value)} style={{...ss,marginBottom:'6px'}}>
                        <option value='morning'>Morning</option>
                        <option value='afternoon'>Afternoon</option>
                        <option value='evening'>Evening</option>
                        <option value='night'>Night</option>
                      </select>
                      {(ph.frequency==='1x/week'||ph.frequency==='2x/week') && <select value={ph.day_of_week} onChange={e => updatePhase(ci,pi,'day_of_week',e.target.value)} style={ss}>{DAYS.map((d,i) => <option key={i} value={i}>Inject on {d}</option>)}</select>}`
);

fs.writeFileSync('app/protocol/manage/page.tsx', content, 'utf8');
console.log('Done! Protocol builder updated.');
