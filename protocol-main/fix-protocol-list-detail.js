const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add selectedProtocolId state
content = content.replace(
  "  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({})\n",
  "  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({})\n  const [selectedProtocolId, setSelectedProtocolId] = useState<string | null>(null)\n"
);

// Replace the protocols list rendering with list/detail logic
const oldListBlock = `        {protocols.map((p: any) => {
          const startMs = new Date(p.start_date + 'T00:00:00').getTime()
          const nowMs = Date.now()
          const daysIn = Math.floor((nowMs - startMs) / (86400000))
          const currentWeek = Math.max(1, Math.floor(daysIn / 7) + 1)
          return (
            <div key={p.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                <div>
                  <h2 style={{fontSize:'17px',fontWeight:'700',color:g}}>{p.name}</h2>
                  <p style={{fontSize:'12px',color:mg,marginTop:'2px'}}>Week {currentWeek} · Started {new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</p>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={() => startEdit(p)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'12px'}}>Edit</button>
                  <button onClick={() => deleteProtocol(p.id)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>Delete</button>
                </div>
              </div>
              {p.notes && <p style={{color:dg,fontSize:'13px',marginBottom:'10px'}}>{p.notes}</p>}
              {(p.compounds || []).map((c: any) => (
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
              ))}
            </div>
          )
        })}`;

const newListDetailBlock = `        {/* LIST VIEW - shown when no protocol selected and form is closed */}
        {!showForm && !selectedProtocolId && protocols.map((p: any) => {
          const startMs = new Date(p.start_date + 'T00:00:00').getTime()
          const daysIn = Math.floor((Date.now() - startMs) / 86400000)
          const currentWeek = Math.max(1, Math.floor(daysIn / 7) + 1)
          const firstCompound = (p.compounds || [])[0]
          const currentPhase = firstCompound?.phases?.find((ph: any) => currentWeek >= ph.start_week && currentWeek <= ph.end_week)
          const compoundCount = (p.compounds || []).length
          return (
            <button key={p.id} onClick={() => setSelectedProtocolId(p.id)} style={{display:'block',width:'100%',textAlign:'left',background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'14px',marginBottom:'10px',cursor:'pointer'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <h2 style={{fontSize:'16px',fontWeight:'700',color:g,marginBottom:'4px'}}>{p.name}</h2>
                  <p style={{fontSize:'12px',color:mg}}>Week {currentWeek}{currentPhase ? ' · ' + currentPhase.dose + currentPhase.dose_unit : ''}{compoundCount > 1 ? ' · ' + compoundCount + ' compounds' : ''}</p>
                </div>
                <span style={{color:mg,fontSize:'18px'}}>›</span>
              </div>
            </button>
          )
        })}

        {/* DETAIL VIEW - shown when a protocol is selected */}
        {!showForm && selectedProtocolId && (() => {
          const p = protocols.find((x: any) => x.id === selectedProtocolId)
          if (!p) { setSelectedProtocolId(null); return null }
          const startMs = new Date(p.start_date + 'T00:00:00').getTime()
          const daysIn = Math.floor((Date.now() - startMs) / 86400000)
          const currentWeek = Math.max(1, Math.floor(daysIn / 7) + 1)
          return (
            <div>
              <button onClick={() => setSelectedProtocolId(null)} style={{background:'none',border:'none',color:dg,fontSize:'13px',cursor:'pointer',padding:0,marginBottom:'14px'}}>← All protocols</button>
              <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                  <div>
                    <h2 style={{fontSize:'18px',fontWeight:'700',color:g}}>{p.name}</h2>
                    <p style={{fontSize:'12px',color:mg,marginTop:'2px'}}>Week {currentWeek} · Started {new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</p>
                  </div>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button onClick={() => startEdit(p)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'13px'}}>Edit</button>
                    <button onClick={() => { if(confirm('Delete this protocol?')) { deleteProtocol(p.id); setSelectedProtocolId(null) } }} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'13px'}}>Delete</button>
                  </div>
                </div>
                {p.notes && <p style={{color:dg,fontSize:'13px',marginBottom:'10px'}}>{p.notes}</p>}
                {(p.compounds || []).map((c: any) => (
                  <div key={c.id} style={{background:'#0a0a0f',borderRadius:'8px',padding:'12px',marginTop:'10px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                      <span style={{fontSize:'14px',fontWeight:'700',color:'white'}}>{c.name}</span>
                      {c.vial_strength && <span style={{fontSize:'11px',color:mg}}>{c.vial_strength}{c.vial_unit} vial · {c.bac_water_ml || '?'}mL BAC</span>}
                    </div>
                    {(c.phases || []).slice().sort((a: any, b: any) => a.start_week - b.start_week).map((ph: any) => {
                      const isCurrent = currentWeek >= ph.start_week && currentWeek <= ph.end_week
                      return (
                        <div key={ph.id} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',fontSize:'12px',color:isCurrent?g:dg}}>
                          <span>{isCurrent && '→ '}{ph.name} · W{ph.start_week}-{ph.end_week}</span>
                          <span style={{color:isCurrent?g:mg}}>{ph.dose}{ph.dose_unit}{ph.syringe_units?' · '+ph.syringe_units+'u':''}</span>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          )
        })()}`;

content = content.replace(oldListBlock, newListDetailBlock);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
