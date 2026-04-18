const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

const oldBlock = `        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:g}}>{totalLost !== null ? totalLost : '—'}{totalLost !== null ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>TOTAL LOST</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#6c63ff'}}>{currentWeek > 0 ? 'Wk ' + currentWeek : '—'}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT WEEK</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{latestWeight ? latestWeight : '—'}{latestWeight ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT</div>
          </div>
        </div>`;

const newBlock = `        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{latestWeight ? latestWeight : '—'}{latestWeight ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT WEIGHT</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:totalLost !== null ? (parseFloat(totalLost) > 0 ? g : parseFloat(totalLost) < 0 ? '#ff6b6b' : g) : g}}>{totalLost !== null ? (parseFloat(totalLost) > 0 ? '-' + Math.abs(parseFloat(totalLost)) : parseFloat(totalLost) < 0 ? '+' + Math.abs(parseFloat(totalLost)) : '0') : '—'}{totalLost !== null ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>WEIGHT CHANGE</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#6c63ff'}}>{currentWeek > 0 ? 'Wk ' + currentWeek : '—'}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT WEEK</div>
          </div>
        </div>`;

content = content.replace(oldBlock, newBlock);
fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
