const fs = require('fs');
let content = fs.readFileSync('components/dashboard/WeeklySchedule.tsx', 'utf8');

// Fix 2: timezone-safe date comparison
content = content.replace(
  `  const isPast = date.getTime() < today.getTime()`,
  `  const isPast = date.getTime() < today.getTime() && !isToday`
);
content = content.replace(
  `  const isFuture = date.getTime() > today.getTime()`,
  `  const isFuture = date.getTime() > today.getTime() && !isToday`
);

// Fix 3: highlight entire column in light mode - add colgroup or use consistent background
content = content.replace(
  `      <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch'}}>`,
  `      <div style={{overflowX:'auto',WebkitOverflowScrolling:'touch',position:'relative'}}>`
);

// Make today column cells have stronger background
content = content.replace(
  `<td key={di} style={{padding:'6px 4px',textAlign:'center',background:isToday?'var(--color-green-05)':'transparent'}}>`,
  `<td key={di} style={{padding:'6px 4px',textAlign:'center',background:isToday?'rgba(57,255,20,0.08)':'transparent',borderLeft:isToday?'1px solid rgba(57,255,20,0.2)':'none',borderRight:isToday?'1px solid rgba(57,255,20,0.2)':'none'}}>`,
);

fs.writeFileSync('components/dashboard/WeeklySchedule.tsx', content, 'utf8');
console.log('Done!');
