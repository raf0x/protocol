const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Replace frequency select options
content = content.replace(
  `<option value='daily'>Daily</option>
                      <option value='eod'>Every other day</option>
                      <option value='3x/week'>3x per week</option>
                      <option value='weekly'>Weekly</option>`,
  `<option value='daily'>Daily (7x/week)</option>
                      <option value='6x/week'>6x/week</option>
                      <option value='5x/week'>5x/week (weekdays)</option>
                      <option value='4x/week'>4x/week</option>
                      <option value='3x/week'>3x/week</option>
                      <option value='2x/week'>2x/week</option>
                      <option value='1x/week'>1x/week</option>
                      <option value='eod'>Every other day</option>
                      <option value='every3days'>Every 3 days</option>
                      <option value='every4days'>Every 4 days</option>
                      <option value='every5days'>Every 5 days</option>
                      <option value='monthly'>Monthly</option>`
);

// Auto-fill protocol name from first compound name
content = content.replace(
  "                  <input value={compound.name} onChange={e => updateCompound(index, 'name', e.target.value)}",
  `                  <input value={compound.name} onChange={e => { updateCompound(index, 'name', e.target.value); if (index === 0) setProtocolName(e.target.value) }}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
