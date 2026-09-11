const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Update the ACTIVE COMPOUNDS section to include loading bars
content = content.replace(
  `        {/* Current Protocol */}
        {activeProtocols.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>ACTIVE COMPOUNDS</div>
            {activeProtocols.map((p: any) => {
              const startMs = new Date(p.start_date + 'T00:00:00').getTime()
              const daysIn = Math.floor((Date.now() - startMs) / 86400000)
              const wk = Math.max(1, Math.floor(daysIn / 7) + 1)
              return (p.compounds || []).map((c: any) => {
                const phase = (c.phases || []).find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || c.phases?.[0]
                return phase ? (
                  <div key={c.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid '+bd}}>
                    <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{c.name}</span>
                    <span style={{fontSize:'12px',color:dg}}>{phase.dose}{phase.dose_unit} · {phase.frequency}</span>
                  </div>
                ) : null
              })
            })}
          </div>
        )}`,
  `        {/* Current Protocol */}
        {activeProtocols.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'10px'}}>ACTIVE COMPOUNDS</div>
            {activeProtocols.map((p: any) => {
              const startMs = new Date(p.start_date + 'T00:00:00').getTime()
              const daysIn = Math.max(0, Math.floor((Date.now() - startMs) / 86400000))
              const wk = Math.max(1, Math.floor(daysIn / 7) + 1)
              return (p.compounds || []).map((c: any) => {
                const phase = (c.phases || []).find((ph: any) => wk >= ph.start_week && wk <= ph.end_week) || c.phases?.[0]
                if (!phase) return null
                const steadyStateDays = 30
                const loadPct = Math.min(100, Math.round((daysIn / steadyStateDays) * 100))
                const isLoaded = loadPct >= 100
                return (
                  <div key={c.id} style={{padding:'8px 0',borderBottom:'1px solid '+bd}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
                      <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{c.name}</span>
                      <span style={{fontSize:'12px',color:dg}}>{phase.dose}{phase.dose_unit} · {phase.frequency}</span>
                    </div>
                    <div style={{background:'#0a0a0f',borderRadius:'6px',height:'22px',overflow:'hidden',position:'relative'}}>
                      <div style={{height:'100%',width:loadPct+'%',background:isLoaded?g:'linear-gradient(90deg, #6c63ff, #8b5cf6)',borderRadius:'6px',transition:'width 0.5s ease'}} />
                      <span style={{position:'absolute',top:0,left:0,right:0,bottom:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'10px',fontWeight:'700',color:'white',letterSpacing:'0.5px'}}>
                        {isLoaded ? '✓ STEADY STATE' : 'Day '+daysIn+'/'+steadyStateDays+' · Protocol Loading ('+loadPct+'%)'}
                      </span>
                    </div>
                  </div>
                )
              })
            })}
          </div>
        )}`
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
