const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

const oldRings = `          <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
            {(() => {
              const items = activeProtocols.flatMap((p: any) => (p.compounds||[]).map((c: any) => { const di = Math.max(0,Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000)); const wk = Math.max(1,Math.floor(di/7)+1); return {id:c.id,name:c.name,wk} })).slice(0,6);    
              const colors = ['var(--color-green)','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635'];
              const total = items.length <= 4 ? 4 : 6; const padded = [...items, ...Array(total-items.length).fill(null)];
              return (
                <div style={{display:'grid',gridTemplateColumns:items.length<=4?'1fr 1fr':'1fr 1fr 1fr',gap:'0px'}}>
                  {padded.map((item: any, i: number) => {
                    const rc = colors[i] || '#6b7280';
                    const cols = items.length <= 4 ? 2 : 3;
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const rows = Math.ceil(padded.length / cols);
                    const isLastCol = col === cols - 1;
                    const isLastRow = row === rows - 1;
                    if (!item) return <div key={i} style={{width:'64px',height:'64px'}} />;
                    const short = item.name.split('/')[0].split(' ')[0].slice(0,6);
                    return (
                      <div key={i} onClick={() => { setActiveCompoundTab(item.id); }} style={{width:'64px',height:'64px',borderRadius:'50%',border:((activeCompoundTab||items[0]?.id)===item.id?'4px':'3px')+' solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLastCol?'0':'-10px',marginBottom:isLastRow?'0':'-10px',background:(activeCompoundTab||items[0]?.id)===item.id?rc+'44':cb,zIndex:row+col,position:'relative',cursor:'pointer',boxShadow:(activeCompoundTab||items[0]?.id)===item.id?'0 0 18px '+rc+', 0 0 6px '+rc:'none',transform:(activeCompoundTab||items[0]?.id)===item.id?'scale(1.15)':'scale(1)',transition:'all 0.2s ease'}}>
                        <span style={{fontSize:'10px',fontWeight:'800',color:'var(--color-text)',textAlign:'center',lineHeight:'1.2',letterSpacing:'0.2px'}}>{short}</span>
                        <span style={{fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'}}>Wk {item.wk}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>`;

if (content.includes(oldRings)) {
  content = content.replace(oldRings, '');
  fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
  console.log('Done! Orphaned rings removed.');
} else {
  console.log('NOT FOUND - paste more lines from check-protocol.js output');
}
