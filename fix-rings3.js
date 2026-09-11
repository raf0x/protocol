const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

const oldRings = `<div style={{display:'grid',gridTemplateColumns:items.length<=4?'1fr 1fr':'1fr 1fr 1fr',gap:'0px'}}>
                  {padded.map((item: any, i: number) => {
                    const rc = colors[i];
                    if (!item) return <div key={i} style={{width:'64px',height:'64px'}} />;
                    const short = item.name.split('/')[0].split(' ')[0].slice(0,6);
                    const isLeft = i % 2 === 0;
                    const isTop = i < 2;
                    return (
                      <div key={i} style={{width:'64px',height:'64px',borderRadius:'50%',border:'3px solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLeft?'-10px':'0',marginBottom:isTop?'-10px':'0',background:cb,zIndex:isTop?1:2,position:'relative'}}>
                        <span style={{fontSize:'10px',fontWeight:'800',color:'white',textAlign:'center',lineHeight:'1.2',letterSpacing:'0.2px'}}>{short}</span>
                        <span style={{fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'}}>Wk {item.wk}</span>
                      </div>
                    );
                  })}
                </div>`;

const newRings = `<div style={{display:'grid',gridTemplateColumns:items.length<=4?'1fr 1fr':'1fr 1fr 1fr',gap:'0px'}}>
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
                      <div key={i} style={{width:'64px',height:'64px',borderRadius:'50%',border:'3px solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLastCol?'0':'-10px',marginBottom:isLastRow?'0':'-10px',background:cb,zIndex:row+col,position:'relative'}}>
                        <span style={{fontSize:'10px',fontWeight:'800',color:'white',textAlign:'center',lineHeight:'1.2',letterSpacing:'0.2px'}}>{short}</span>
                        <span style={{fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'}}>Wk {item.wk}</span>
                      </div>
                    );
                  })}
                </div>`;

if (content.includes(oldRings)) {
  content = content.replace(oldRings, newRings);
  fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
  console.log('Done!');
} else {
  console.log('NOT FOUND');
}
