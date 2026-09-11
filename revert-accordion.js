const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Remove the expandedCompounds state
content = content.replace(
  "  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({})\n  const [expandedCompounds, setExpandedCompounds] = useState<Record<string, boolean>>({})\n",
  "  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({})\n"
);

// Replace the accordion block with the original simple display
const accordionBlock = `              {(p.compounds || []).map((c: any) => {
                const isExpanded = expandedCompounds[c.id]
                const sortedPhases = (c.phases || []).slice().sort((a: any, b: any) => a.start_week - b.start_week)
                const currentPhase = sortedPhases.find((ph: any) => currentWeek >= ph.start_week && currentWeek <= ph.end_week)
                return (
                  <div key={c.id} style={{background:'#0a0a0f',borderRadius:'8px',padding:'10px',marginTop:'8px'}}>
                    <button onClick={() => setExpandedCompounds({...expandedCompounds, [c.id]: !isExpanded})} style={{background:'none',border:'none',width:'100%',padding:0,cursor:'pointer',textAlign:'left'}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                          <span style={{color:mg,fontSize:'11px',transition:'transform 0.2s',display:'inline-block',transform:isExpanded?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
                          <span style={{fontSize:'14px',fontWeight:'700',color:'white'}}>{c.name}</span>
                        </div>
                        {currentPhase ? (
                          <span style={{fontSize:'11px',color:g,fontWeight:'600'}}>→ {currentPhase.dose}{currentPhase.dose_unit}</span>
                        ) : c.vial_strength ? (
                          <span style={{fontSize:'11px',color:mg}}>{c.vial_strength}{c.vial_unit}</span>
                        ) : null}
                      </div>
                    </button>
                    {isExpanded && (
                      <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid '+bd}}>
                        {c.vial_strength && <div style={{fontSize:'11px',color:mg,marginBottom:'8px'}}>{c.vial_strength}{c.vial_unit} vial · {c.bac_water_ml || '?'}mL BAC</div>}
                        {sortedPhases.map((ph: any) => {
                          const isCurrent = currentWeek >= ph.start_week && currentWeek <= ph.end_week
                          return (
                            <div key={ph.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:'12px',color:isCurrent?g:dg}}>
                              <span>{isCurrent && '→ '}{ph.name} · W{ph.start_week}-{ph.end_week}</span>
                              <span style={{color:isCurrent?g:mg}}>{ph.dose}{ph.dose_unit}{ph.syringe_units?' · '+ph.syringe_units+'u':''}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}`;

const simpleBlock = `              {(p.compounds || []).map((c: any) => (
                <div key={c.id} style={{background:'#0a0a0f',borderRadius:'8px',padding:'10px',marginTop:'8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                    <span style={{fontSize:'14px',fontWeight:'700',color:'white'}}>{c.name}</span>
                    {c.vial_strength && <span style={{fontSize:'11px',color:mg}}>{c.vial_strength}{c.vial_unit} vial · {c.bac_water_ml || '?'}mL BAC</span>}
                  </div>
                  {(c.phases || []).sort((a: any, b: any) => a.start_week - b.start_week).map((ph: any) => {
                    const isCurrent = currentWeek >= ph.start_week && currentWeek <= ph.end_week
                    return (
                      <div key={ph.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:'12px',color:isCurrent?g:dg}}>
                        <span>{isCurrent && '→ '}{ph.name} · W{ph.start_week}-{ph.end_week}</span>
                        <span style={{color:isCurrent?g:mg}}>{ph.dose}{ph.dose_unit}{ph.syringe_units?' · '+ph.syringe_units+'u':''}</span>
                      </div>
                    )
                  })}
                </div>
              ))}`;

content = content.replace(accordionBlock, simpleBlock);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
