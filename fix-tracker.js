const fs = require('fs');
let content = fs.readFileSync('app/tracker/page.tsx', 'utf8');

// Fix 1: Make CURRENT_WEEK dynamic instead of hardcoded
content = content.replace(
  `const CURRENT_WEEK = 6`,
  `const CURRENT_WEEK = Math.max(1, Math.floor((Date.now() - new Date('2026-03-15T00:00:00').getTime()) / 86400000 / 7) + 1)`
);

// Fix 2: Add retaShots state
content = content.replace(
  `const [wolverineLog, setWolverineLog] = useState(defaultWolverine)`,
  `const [wolverineLog, setWolverineLog] = useState(defaultWolverine)
  const [retaShots, setRetaShots] = useState<Record<number, boolean>>({})`
);

// Fix 3: Load retaShots from localStorage
content = content.replace(
  `if (d.wolverine) setWolverineLog(d.wolverine)`,
  `if (d.wolverine) setWolverineLog(d.wolverine)
            if (d.retaShots) setRetaShots(d.retaShots)`
);

// Fix 4: Save retaShots in saveAll
content = content.replace(
  `function saveAll(w?: any, c?: any, h?: any, gk?: any, wl?: any) {
    const data = { weights: w || weights, cjc: c || cjcLog, hcg: h || hcgLog, ghk: gk || ghkLog, wolverine: wl || wolverineLog }
    localStorage.setItem('raf_tracker', JSON.stringify(data))
  }`,
  `function saveAll(w?: any, c?: any, h?: any, gk?: any, wl?: any, rs?: any) {
    const data = { weights: w || weights, cjc: c || cjcLog, hcg: h || hcgLog, ghk: gk || ghkLog, wolverine: wl || wolverineLog, retaShots: rs || retaShots }
    localStorage.setItem('raf_tracker', JSON.stringify(data))
  }

  function toggleRetaShot(weekNum: number) {
    const updated = { ...retaShots, [weekNum]: !retaShots[weekNum] }
    setRetaShots(updated)
    saveAll(undefined, undefined, undefined, undefined, undefined, updated)
  }`
);

// Fix 5: Add shot toggle to each week row in Reta tab
content = content.replace(
  `{isActive && editingWeek === weekNum ? (
                        <div style={{display:'flex',gap:'4px'}}>
                          <input type='number' step='0.1' value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSaveWeight(weekNum)} style={{width:'70px',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'4px 6px',color:'white',fontSize:'12px',textAlign:'center'}} autoFocus />
                          <button onClick={() => handleSaveWeight(weekNum)} style={{background:g,color:'var(--color-green-text)',border:'none',borderRadius:'4px',padding:'4px 8px',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>?</button>
                        </div>
                      ) : isActive ? (
                        <button onClick={() => { setEditingWeek(weekNum); setInputVal(weight?String(weight):'') }} style={{fontSize:'12px',fontWeight:'600',padding:'4px 10px',borderRadius:'6px',cursor:'pointer',border:'1px solid '+(weight?'rgba(57,255,20,0.3)':bd),background:weight?'rgba(57,255,20,0.05)':'transparent',color:weight?g:dg}}>{weight ? weight+' lbs' : 'tap'}</button>
                      ) : null}`,
  `{isActive && (
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <button onClick={() => toggleRetaShot(weekNum)} style={{fontSize:'11px',fontWeight:'700',padding:'4px 8px',borderRadius:'6px',cursor:'pointer',border:'none',background:retaShots[weekNum]?'rgba(57,255,20,0.2)':'rgba(255,255,255,0.05)',color:retaShots[weekNum]?g:dg,whiteSpace:'nowrap'}}>{retaShots[weekNum]?'? Shot':'Shot?'}</button>
                          {editingWeek === weekNum ? (
                            <div style={{display:'flex',gap:'4px'}}>
                              <input type='number' step='0.1' value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => e.key==='Enter' && handleSaveWeight(weekNum)} style={{width:'65px',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'4px 6px',color:'white',fontSize:'12px',textAlign:'center'}} autoFocus />
                              <button onClick={() => handleSaveWeight(weekNum)} style={{background:g,color:'var(--color-green-text)',border:'none',borderRadius:'4px',padding:'4px 8px',fontSize:'11px',fontWeight:'700',cursor:'pointer'}}>?</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingWeek(weekNum); setInputVal(weight?String(weight):'') }} style={{fontSize:'12px',fontWeight:'600',padding:'4px 10px',borderRadius:'6px',cursor:'pointer',border:'1px solid '+(weight?'rgba(57,255,20,0.3)':bd),background:weight?'rgba(57,255,20,0.05)':'transparent',color:weight?g:dg}}>{weight ? weight+' lbs' : 'wt?'}</button>
                          )}
                        </div>
                      )}`
);

fs.writeFileSync('app/tracker/page.tsx', content, 'utf8');
console.log('Done!');
