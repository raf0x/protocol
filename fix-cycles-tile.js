const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

const find = `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:'#6c63ff'}}>{currentWeek > 0 ? 'Wk '+currentWeek : '\u2014'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEEK OF CYCLE</div></div>`;

const replace = `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px'}}>
            <div style={{fontSize:'10px',color:dg,marginBottom:'7px',letterSpacing:'1px',fontWeight:'600',textAlign:'center'}}>CYCLES</div>
            {activeProtocols.flatMap((p: any) => (p.compounds||[]).map((c: any) => { const di = Math.max(0,Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000)); const wk = Math.max(1,Math.floor(di/7)+1); return {name:c.name,wk} })).slice(0,4).map((item: any, i: number) => { const rc = ['#39ff14','#6c63ff','#f59e0b','#06b6d4'][i]; const short = item.name.split('/')[0].split('-')[0].split(' ')[0].slice(0,7); return (<div key={i} style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:i<3?'5px':'0'}}><div style={{width:'11px',height:'11px',borderRadius:'50%',border:'2px solid '+rc,flexShrink:0}} /><span style={{fontSize:'11px',fontWeight:'700',color:'white',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{short} \u00b7 Wk {item.wk}</span></div>) })}
          </div>`;

if (content.includes(find)) {
  content = content.replace(find, replace);
  fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
  console.log('Done! Tile replaced.');
} else {
  console.log('NOT FOUND - string did not match');
}
