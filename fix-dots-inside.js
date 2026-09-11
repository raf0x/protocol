const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Remove the dots strip from above the charts
content = content.replace(
  `            {protocolEvents.length > 0 && (<div style={{marginBottom:'12px'}}>
              <span style={{fontSize:'10px',color:mg,letterSpacing:'1px',fontWeight:'600',display:'block',marginBottom:'6px'}}>EVENTS (tap to view)</span>
              <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                {protocolEvents.map((ev: any, i: number) => {
                  const evDate = new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})
                  return <button key={ev.id||i} onClick={() => setSelectedEvent(selectedEvent?.id===ev.id?null:ev)} style={{width:'18px',height:'18px',borderRadius:'50%',background:selectedEvent?.id===ev.id?eventColor(ev.event_type):'transparent',border:'2px solid '+eventColor(ev.event_type),cursor:'pointer',padding:0,position:'relative'}}>
                    {selectedEvent?.id===ev.id && <span style={{position:'absolute',top:'-2px',left:'-2px',right:'-2px',bottom:'-2px',borderRadius:'50%',border:'2px solid white'}} />}
                  </button>
                })}
              </div>
              {selectedEvent && (
                <div style={{marginTop:'10px',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'10px',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                  <div style={{width:'10px',height:'10px',borderRadius:'50%',background:eventColor(selectedEvent.event_type),marginTop:'3px',flexShrink:0}} />
                  <div>
                    <span style={{fontSize:'10px',color:eventColor(selectedEvent.event_type),fontWeight:'700',textTransform:'uppercase',display:'block',marginBottom:'2px'}}>{selectedEvent.event_type.replace(/_/g,' ')}</span>
                    <span style={{fontSize:'13px',color:'white',fontWeight:'600',display:'block'}}>{selectedEvent.description}</span>
                    <span style={{fontSize:'11px',color:dg,marginTop:'2px',display:'block'}}>{new Date(selectedEvent.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  </div>
                  <button onClick={() => setSelectedEvent(null)} style={{marginLeft:'auto',background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'14px'}}>×</button>
                </div>
              )}
            </div>)}`,
  ""
);

// Add dots strip AFTER the mood/energy/sleep chart (between the two charts, inside the card)
content = content.replace(
  "{we.length > 1 && (<>",
  `{protocolEvents.length > 0 && (
              <div style={{marginTop:'8px',marginBottom:'8px',padding:'8px 0',borderTop:'1px solid '+bd}}>
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:'9px',color:mg,fontWeight:'600',marginRight:'4px'}}>EVENTS</span>
                  {protocolEvents.map((ev: any, i: number) => (
                    <button key={ev.id||i} onClick={() => setSelectedEvent(selectedEvent?.id===ev.id?null:ev)} title={ev.description} style={{width:'16px',height:'16px',borderRadius:'50%',background:selectedEvent?.id===ev.id?eventColor(ev.event_type):'transparent',border:'2px solid '+eventColor(ev.event_type),cursor:'pointer',padding:0}}>
                    </button>
                  ))}
                </div>
                {selectedEvent && (
                  <div style={{marginTop:'8px',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',display:'flex',alignItems:'flex-start',gap:'8px'}}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:eventColor(selectedEvent.event_type),marginTop:'4px',flexShrink:0}} />
                    <div style={{flex:1}}>
                      <span style={{fontSize:'10px',color:eventColor(selectedEvent.event_type),fontWeight:'700',textTransform:'uppercase'}}>{selectedEvent.event_type.replace(/_/g,' ')}</span>
                      <span style={{fontSize:'12px',color:'white',fontWeight:'600',display:'block',marginTop:'2px'}}>{selectedEvent.description}</span>
                      <span style={{fontSize:'10px',color:dg,display:'block',marginTop:'2px'}}>{new Date(selectedEvent.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                    </div>
                    <button onClick={() => setSelectedEvent(null)} style={{background:'none',border:'none',color:mg,cursor:'pointer',fontSize:'12px'}}>×</button>
                  </div>
                )}
              </div>
            )}
            {we.length > 1 && (<>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
