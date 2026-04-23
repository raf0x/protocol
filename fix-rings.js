const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

const find = `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px'}}>
            <div style={{fontSize:'10px',color:dg,marginBottom:'7px',letterSpacing:'1px',fontWeight:'600',textAlign:'center'}}>CYCLES</div>
            {activeProtocols.flatMap((p: any) => (p.compounds||[]).map((c: any) => { const di = Math.max(0,Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000)); const wk = Math.max(1,Math.floor(di/7)+1); return {name:c.name,wk} })).slice(0,4).map((item: any, i: number) => { const rc = ['#39ff14','#6c63ff','#f59e0b','#06b6d4'][i]; const short = item.name.split('/')[0].split('-')[0].split(' ')[0].slice(0,7); return (<div key={i} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:i<3?'5px':'0'}}><div style={{width:'11px',height:'11px',borderRadius:'50%',border:'2px solid '+rc,flexShrink:0}} /><span style={{fontSize:'11px',fontWeight:'700',color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{short} \u00b7 Wk {item.wk}</span></div>) })}
          </div>`;

const replace = `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'10px',display:'flex',alignItems:'center',justifyContent:'center'}}>
            {(() => {
              const items = activeProtocols.flatMap((p: any) => (p.compounds||[]).map((c: any) => { const di = Math.max(0,Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000)); const wk = Math.max(1,Math.floor(di/7)+1); return {name:c.name,wk} })).slice(0,4);
              const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4'];
              const padded = [...items, ...Array(4-items.length).fill(null)];
              return (
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0px'}}>
                  {padded.map((item: any, i: number) => {
                    const rc = colors[i];
                    if (!item) return <div key={i} style={{width:'54px',height:'54px'}} />;
                    const short = item.name.split('/')[0].split(' ')[0].slice(0,6);
                    const isLeft = i % 2 === 0;
                    const isTop = i < 2;
                    return (
                      <div key={i} style={{width:'54px',height:'54px',borderRadius:'50%',border:'3px solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLeft?'-10px':'0',marginBottom:isTop?'-10px':'0',background:cb,zIndex:isTop?1:2,position:'relative'}}>
                        <span style={{fontSize:'9px',fontWeight:'800',color:'white',textAlign:'center',lineHeight:'1.2',letterSpacing:'0.2px'}}>{short}</span>
                        <span style={{fontSize:'9px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'}}>Wk {item.wk}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>`;

if (content.includes(find)) {
  content = content.replace(find, replace);
  fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
  console.log('Done! Rings tile updated.');
} else {
  console.log('NOT FOUND - string did not match');
}
