const fs = require('fs');

const files = [
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/community/page.tsx',
  'app/profile/page.tsx',
  'app/calculator/page.tsx',
  'app/protocol/manage/page.tsx',
  'components/BottomNav.tsx',
];

files.forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  let c = fs.readFileSync(filepath, 'utf8');

  // All green background + black text patterns
  c = c.split("background:active?'var(--color-green-10)':cb,color:active?g:dg").join("background:active?'var(--color-green-10)':cb,color:active?'var(--color-green-text)':dg");
  c = c.split("background:active?g:cb,color:active?'#000':dg").join("background:active?g:cb,color:active?'var(--color-green-text)':dg");
  c = c.split("background:active?g:cb,color:active?'#000000':dg").join("background:active?g:cb,color:active?'var(--color-green-text)':dg");
  c = c.split("background:isActive?activeColor:cb,color:isActive?'#000':dg").join("background:isActive?activeColor:cb,color:isActive?'var(--color-green-text)':dg");
  c = c.split("background:isActive?activeColor:cb,color:isActive?'#000000':dg").join("background:isActive?activeColor:cb,color:isActive?'var(--color-green-text)':dg");
  c = c.split("background:isCur?g:'rgba(255,255,255,0.08)',color:isCur?'#000':dg").join("background:isCur?g:'rgba(255,255,255,0.08)',color:isCur?'var(--color-green-text)':dg");
  c = c.split("background:isCur?g:'rgba(255,255,255,0.08)',color:isCur?'var(--color-green-text)':dg").join("background:isCur?g:'rgba(255,255,255,0.08)',color:isCur?'var(--color-green-text)':dg");
  c = c.split("background:smartMode?'rgba(57,255,20,0.1)':cb,color:smartMode?g:dg").join("background:smartMode?'var(--color-green-10)':cb,color:smartMode?'var(--color-green-text)':dg");

  // Catch-all: any remaining color:'#000' or color:'#000000' near green backgrounds
  // ScoreBtn active state
  c = c.split("background:isActive?activeColor:cb,color:isActive?'#000':dg").join("background:isActive?activeColor:cb,color:isActive?'var(--color-green-text)':dg");

  // Steady state bar text
  c = c.split("color:il?'#000':'white'").join("color:il?'var(--color-green-text)':'var(--color-text)'");

  // Toggle button knob — green knob in light mode needs dark text
  c = c.split("background:theme==='dark'?'var(--color-dim)':'var(--color-green)'").join("background:theme==='dark'?'var(--color-dim)':'var(--color-green)'");

  // Phase label tags
  c = c.split("color:'#000000',background:eventColor").join("color:'var(--color-green-text)',background:eventColor");

  // Event type tags
  c = c.split("fontSize:'10px',color:'#0a0a0f',background:ev.event_type").join("fontSize:'10px',color:'var(--color-green-text)',background:ev.event_type");

  // Save/Update/Create buttons - any remaining #000
  c = c.split(":'#000',border:'none',borderRadius:'6px',padding:'10px'").join(":'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'10px'");
  c = c.split(":'#000',border:'none',borderRadius:'6px',padding:'8px'").join(":'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'8px'");
  c = c.split(":'#000',border:'none',borderRadius:'8px'").join(":'var(--color-green-text)',border:'none',borderRadius:'8px'");
  c = c.split(":'#000',fontWeight:'700',padding:'14px'").join(":'var(--color-green-text)',fontWeight:'700',padding:'14px'");
  c = c.split(":'#000',fontWeight:'700',padding:'12px'").join(":'var(--color-green-text)',fontWeight:'700',padding:'12px'");
  c = c.split(":'#000',fontWeight:'800',padding:'16px 36px'").join(":'var(--color-green-text)',fontWeight:'800',padding:'16px 36px'");
  c = c.split(":'#000',fontWeight:'800',padding:'18px 48px'").join(":'var(--color-green-text)',fontWeight:'800',padding:'18px 48px'");
  c = c.split(":'#000000',fontWeight:'700'").join(":'var(--color-green-text)',fontWeight:'700'");
  c = c.split(":'#000000',fontWeight:'800'").join(":'var(--color-green-text)',fontWeight:'800'");
  c = c.split(":'#000000',textDecoration:'none'").join(":'var(--color-green-text)',textDecoration:'none'");
  c = c.split('color:"#000000"').join('color:"var(--color-green-text)"');

  // Nuclear option: any remaining bare #000 or #000000 values
  c = c.split("color:'#000'").join("color:'var(--color-green-text)'");
  c = c.split("color:'#000000'").join("color:'var(--color-green-text)'");

  fs.writeFileSync(filepath, c, 'utf8');
  console.log('Done: ' + filepath);
});

console.log('All files updated.');
