const fs = require('fs');

// Fix 1: Dashboard - event type tags (STARTED etc)
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');
protocol = protocol.split(
  "fontSize:'10px',color:'#0a0a0f',background:ev.event_type==='started'?g:"
).join(
  "fontSize:'10px',color:'var(--color-green-text)',background:ev.event_type==='started'?g:"
);
// Also fix the history page version
fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('Fixed protocol event tags');

// Fix 2: History page same tags
let journal = fs.readFileSync('app/journal/page.tsx', 'utf8');
journal = journal.split(
  "fontSize:'10px',color:'#0a0a0f',background:ev.event_type==='started'?g:"
).join(
  "fontSize:'10px',color:'var(--color-green-text)',background:ev.event_type==='started'?g:"
);
fs.writeFileSync('app/journal/page.tsx', journal, 'utf8');
console.log('Fixed journal event tags');

// Fix 3: Community - full overhaul of badge and button styles
let community = fs.readFileSync('app/community/page.tsx', 'utf8');

// JOINED badge - dark green bg, white text
community = community.split(
  "{isJoined && <span style={{fontSize:'10px',color:mg,background:'#0a1a0a',padding:'2px 6px',borderRadius:'4px'}}>JOINED</span>}"
).join(
  "{isJoined && <span style={{fontSize:'10px',color:'var(--color-green-text)',background:'var(--color-green)',padding:'2px 8px',borderRadius:'4px',fontWeight:'700'}}>JOINED</span>}"
);

// View button
community = community.split(
  "style={{background:'#0a1a0a',color:dg,fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer',border:'none'}}>View"
).join(
  "style={{background:'var(--color-surface)',color:'var(--color-dim)',fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer',border:'1px solid var(--color-border)'}}>View"
);

// Leave button
community = community.split(
  "style={{background:isJoined?'#1a0000':'#0a1a0a',border:'1px solid '+(isJoined?'#4a0000':mg),color:isJoined?'#ff6b6b':dg,fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer'}}"
).join(
  "style={{background:isJoined?'rgba(255,107,107,0.1)':'var(--color-surface)',border:'1px solid '+(isJoined?'rgba(255,107,107,0.4)':'var(--color-border)'),color:isJoined?'#ff6b6b':'var(--color-dim)',fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer'}}"
);

// Cohort card border when joined
community = community.split(
  "border:'1px solid '+(isJoined?mg:bd)"
).join(
  "border:'1px solid '+(isJoined?'var(--color-green)':'var(--color-border)')"
);

// Cohort name color when joined
community = community.split(
  "color:isJoined?g:'var(--color-text)'"
).join(
  "color:isJoined?'var(--color-green)':'var(--color-text)'"
);

fs.writeFileSync('app/community/page.tsx', community, 'utf8');
console.log('Fixed community styles');
