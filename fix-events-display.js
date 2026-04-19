const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// 1. Fix chart marker labels to be more visible
content = content.replace(
  "label={{value: m.label, position: 'top', fontSize: 9, fill: '#6c63ff'}}",
  "label={{value: m.label, position: 'insideTopRight', fontSize: 10, fill: '#a78bfa', fontWeight: 700, offset: 8}}"
);

// 2. Make "Manage stack" more visible
content = content.replace(
  "style={{background:'none',border:'none',color:mg,fontSize:'11px',cursor:'pointer'}}>{showProtocols ? 'Hide details' : 'Manage stack →'}",
  "style={{background:'none',border:'none',color:'#8b8ba7',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>{showProtocols ? 'Hide details' : 'Manage stack →'}"
);

// 3. Add recent events display below the event logger button
content = content.replace(
  "        {/* Today's injections */}",
  `        {/* Recent events */}
        {protocolEvents.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>PROTOCOL TIMELINE</span>
            {protocolEvents.slice(-5).reverse().map((ev: any, i: number) => (
              <div key={ev.id || i} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'8px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>
                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:ev.event_type==='started'?g:ev.event_type==='dose_change'?'#f59e0b':ev.event_type==='compound_added'?'#06b6d4':ev.event_type==='compound_removed'?'#ff6b6b':'#6c63ff',marginTop:'4px',flexShrink:0}} />
                <div>
                  <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{ev.description}</span>
                  <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginTop:'2px'}}>{new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Today's injections */}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
