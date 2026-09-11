const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Smart Journal card
content = content.replace(
  "            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Smart Journal</h3>\n            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Log your mood, energy, and sleep daily. Watch patterns emerge over time with trend charts, weekly comparisons, and streak tracking. Understand what's actually working.</p>",
  "            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Smart Journal</h3>\n            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Mood, energy, sleep, hunger, weight — logged in seconds. Real-time insights tell you what's working and what's not.</p>"
);

// Protocol Builder card
content = content.replace(
  "            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Protocol Builder</h3>\n            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Build and manage your protocols with compound tracking, dosing schedules, and frequency settings. The reconstitution calculator handles the math so you don't have to.</p>",
  "            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Protocol Builder</h3>\n            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Compounds, phases, dose progression — all in one place. Exact syringe units, no math errors. Never guess a dose again.</p>"
);

// Private Community card
content = content.replace(
  "            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Private Community</h3>\n            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Join cohorts matched to your protocols — GLP-1s, peptides, TRT, and more. Read real experiences from others anonymously. No vendor talk. No noise.</p>",
  "            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Private Community</h3>\n            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Anonymous cohorts for GLP-1, peptides, and TRT users. Real experiences from real people. No vendors, no noise, no exposure.</p>"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
