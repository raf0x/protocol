const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add activeCompoundTab state
content = content.replace(
  'const [showProtocols, setShowProtocols] = useState(false)',
  'const [showProtocols, setShowProtocols] = useState(false)\n  const [activeCompoundTab, setActiveCompoundTab] = useState(null)'
);

// Replace ACTIVE COMPOUNDS section
const acStart = '        {/* Active Compounds */}';
const acEnd = '        {/* Event logger */}';
const acStartIdx = content.indexOf(acStart);
const acEndIdx = content.indexOf(acEnd);

const newAC = `        {/* Active Compounds - Tabbed */}
        {activeProtocols.length > 0 && (() => {
          const allCompounds = activeProtocols.flatMap((p) => (p.compounds || []).map((c) => ({ ...c, protocol: p })))
          const tabId = activeCompoundTab || allCompounds[0]?.id
          const active = allCompounds.find((c) => c.id === tabId)
          const ap = active?.protocol
          return (
            <div style={{marginBottom:'16px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>ACTIVE COMPOUNDS</span>
                <a href='/protocol/manage' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'12px',fontWeight:'700'}}>+ Add / Edit \u2192</a>
              </div>
              <div style={{display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px'}}>
                {allCompounds.map((c) => (
                  <button key={c.id} onClick={() => setActiveCompoundTab(c.id)} style={{padding:'8px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,border:tabId===c.id?'1px solid '+g:'1px solid '+bd,background:tabId===c.id?'rgba(57,255,20,0.1)':cb,color:tabId===c.id?g:dg}}>{c.name}</button>
                ))}
              </div>
              {active && ap && (() => {
                const daysIn = Math.max(0, Math.floor((Date.now()-new Date(ap.start_date+'T00:00:00').getTime())/86400000))
                const wk = Math.max(1, Math.floor(daysIn/7)+1)
                const ssd = 30; const lp = Math.min(100, Math.round((daysIn/ssd)*100)); const il = lp >= 100
                const phases = (active.phases || []).slice().sort((a, b) => a.start_week - b.start_week)
                const currentPhase = phases.find((ph) => wk >= ph.start_week && wk <= ph.end_week) || phases[0]
                const isDue = !!dueCompounds.find((d) => d.id === active.id)
                const log = logs[active.id]; const taken = log?.taken || false; const dis = log?.discomfort || 0
                let vialDaysLeft = null; let vialDaysSince = null
                if (active.reconstitution_date) { const rd = new Date(active.reconstitution_date+'T00:00:00'); vialDaysSince = Math.floor((Date.now()-rd.getTime())/86400000); vialDaysLeft = 28-vialDaysSince }
                return (
                  <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
                    <div style={{background:'#0a0a0f',borderRadius:'6px',height:'22px',overflow:'hidden',position:'relative',marginBottom:'12px'}}>
                      <div style={{height:'100%',width:lp+'%',background:il?g:'linear-gradient(90deg, #6c63ff, #8b5cf6)',borderRadius:'6px'}} />
                      <span style={{position:'absolute',top:0,left:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',color:'white',letterSpacing:'0.5px'}}>{il ? '\u2713 STEADY STATE' : 'Day '+daysIn+'/'+ssd+' \u00b7 Protocol Loading ('+lp+'%)'}</span>
                    </div>
                    {vialDaysLeft !== null && vialDaysSince !== null && (
                      <div style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid '+bd,marginBottom:'8px'}}>
                        <span style={{fontSize:'12px',color:dg}}>Vial status</span>
                        <span style={{fontSize:'12px',fontWeight:'700',color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'#c4c4dd'}}>{vialDaysLeft>0?vialDaysLeft+'d left':'expired'} ({vialDaysSince}d old){active.bac_water_ml ? ' \u00b7 '+active.bac_water_ml+'mL BAC' : ''}</span>
                      </div>
                    )}
                    <span style={{fontSize:'10px',color:dg,fontWeight:'700',letterSpacing:'1px',display:'block',marginBottom:'6px'}}>PHASE TIMELINE</span>
                    {phases.map((ph, i) => {
                      const isCur = wk >= ph.start_week && wk <= ph.end_week
                      return (
                        <div key={ph.id||i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'7px 0',borderBottom:i<phases.length-1?'1px solid '+bd:'none'}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                            <span style={{fontSize:'10px',fontWeight:'700',padding:'2px 7px',borderRadius:'4px',background:isCur?g:'rgba(255,255,255,0.08)',color:isCur?'#000':dg}}>{ph.name||'P'+(i+1)}</span>
                            <div>
                              <span style={{fontSize:'13px',fontWeight:'600',color:isCur?'white':dg}}>{ph.dose}{ph.dose_unit}</span>
                              <span style={{fontSize:'11px',color:mg,display:'block'}}>W{ph.start_week}\u2013W{ph.end_week} \u00b7 {ph.frequency}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {isDue && (
                      <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid '+bd}}>
                        <span style={{fontSize:'10px',color:dg,fontWeight:'700',letterSpacing:'1px',display:'block',marginBottom:'8px'}}>TODAY'S DOSE</span>
                        <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:taken?'10px':'0'}}>
                          <button onClick={() => toggleInjection(active.id)} style={{width:'26px',height:'26px',borderRadius:'6px',border:'1px solid '+(taken?g:bd),background:taken?g:'transparent',cursor:'pointer',color:'#000',fontWeight:'800',padding:0}}>{taken ? '\u2713' : ''}</button>
                          <span style={{fontSize:'14px',fontWeight:'600',color:taken?dg:'white',textDecoration:taken?'line-through':'none'}}>{currentPhase?.dose}{currentPhase?.dose_unit} \u00b7 {currentPhase?.frequency}</span>
                        </div>
                        {taken && <div><span style={{fontSize:'10px',color:mg,display:'block',marginBottom:'6px',letterSpacing:'1px'}}>DISCOMFORT (0 = none)</span><div style={{display:'flex',gap:'6px'}}>{[0,1,2,3,4,5].map(n => <DiscomfortBtn key={n} value={n} current={dis} onChange={v => setDiscomfortVal(active.id, v)} />)}</div></div>}
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )
        })()}

`;

content = content.slice(0, acStartIdx) + newAC + content.slice(acEndIdx);

// Remove old TODAY'S INJECTIONS section (now lives inside the tab)
const tiStart = "        {/* Today's injections */}";
const tiEnd = "        {/* Daily log */}";
const tiStartIdx = content.indexOf(tiStart);
const tiEndIdx = content.indexOf(tiEnd);
if (tiStartIdx !== -1 && tiEndIdx !== -1) {
  content = content.slice(0, tiStartIdx) + content.slice(tiEndIdx);
}

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Dashboard updated.');
