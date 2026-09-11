const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Remove missed dose banner
content = content.replace(
  `        {/* Missed dose banner */}
        {missedDoses.length > 0 && (
          <div style={{background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.3)',borderRadius:'12px',padding:'14px 16px',marginBottom:'16px',display:'flex',gap:'12px',alignItems:'flex-start'}}>
            <span style={{fontSize:'16px',flexShrink:0}}>&#9888;</span>
            <div>
              <span style={{fontSize:'12px',fontWeight:'700',color:'#f97316',display:'block',marginBottom:'2px'}}>Looks like you may have missed a dose today</span>
              <span style={{fontSize:'12px',color:'var(--color-dim)'}}>{missedDoses.join(', ')} {missedDoses.length === 1 ? 'was' : 'were'} due but not logged. Tap the compound tab to log it.</span>
            </div>
          </div>
        )}`,
  ``
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Removed missed dose banner.');
