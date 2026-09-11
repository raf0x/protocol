const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add showAdvanced state after the error state
content = content.replace(
  "  const [error, setError] = useState('')\n",
  "  const [error, setError] = useState('')\n  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({})\n"
);

// Replace the entire phase form block
const oldPhaseBlock = `                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'6px'}}>
                          <input type='number' step='0.01' value={ph.dose} onChange={e => updatePhase(ci, pi, 'dose', e.target.value)} placeholder='Dose' style={smallInputStyle} />
                          <select value={ph.dose_unit} onChange={e => updatePhase(ci, pi, 'dose_unit', e.target.value)} style={smallInputStyle}>
                            <option value='mg'>mg</option>
                            <option value='mcg'>mcg</option>
                            <option value='IU'>IU</option>
                          </select>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'6px'}}>
                          <input type='number' value={ph.syringe_units} onChange={e => updatePhase(ci, pi, 'syringe_units', e.target.value)} placeholder='Syringe units' style={smallInputStyle} />
                          <input type='number' step='0.01' value={ph.volume_ml} onChange={e => updatePhase(ci, pi, 'volume_ml', e.target.value)} placeholder='Volume mL' style={smallInputStyle} />
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginBottom:'6px'}}>
                          <input type='number' min='1' value={ph.start_week} onChange={e => updatePhase(ci, pi, 'start_week', e.target.value)} placeholder='Start week' style={smallInputStyle} />
                          <input type='number' min='1' value={ph.end_week} onChange={e => updatePhase(ci, pi, 'end_week', e.target.value)} placeholder='End week' style={smallInputStyle} />
                        </div>
                        <select value={ph.frequency} onChange={e => updatePhase(ci, pi, 'frequency', e.target.value)} style={{...smallInputStyle,marginBottom:'6px'}}>
                          {FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        {(ph.frequency === '1x/week' || ph.frequency === '2x/week') && (
                          <select value={ph.day_of_week} onChange={e => updatePhase(ci, pi, 'day_of_week', e.target.value)} style={smallInputStyle}>
                            {DAYS.map((d, i) => <option key={i} value={i}>Inject on {d}</option>)}
                          </select>
                        )}`;

const newPhaseBlock = `                        <label style={{display:'block',fontSize:'10px',color:mg,marginTop:'6px',marginBottom:'2px',fontWeight:'600'}}>DOSE</label>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 80px',gap:'6px',marginBottom:'8px'}}>
                          <input type='number' step='0.01' value={ph.dose} onChange={e => updatePhase(ci, pi, 'dose', e.target.value)} placeholder='e.g. 2.5' style={smallInputStyle} />
                          <select value={ph.dose_unit} onChange={e => updatePhase(ci, pi, 'dose_unit', e.target.value)} style={smallInputStyle}>
                            <option value='mg'>mg</option>
                            <option value='mcg'>mcg</option>
                            <option value='IU'>IU</option>
                          </select>
                        </div>
                        <label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',fontWeight:'600'}}>WEEKS</label>
                        <div style={{display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:'6px',marginBottom:'8px',alignItems:'center'}}>
                          <input type='number' min='1' value={ph.start_week} onChange={e => updatePhase(ci, pi, 'start_week', e.target.value)} placeholder='Start' style={smallInputStyle} />
                          <span style={{color:mg,fontSize:'12px'}}>to</span>
                          <input type='number' min='1' value={ph.end_week} onChange={e => updatePhase(ci, pi, 'end_week', e.target.value)} placeholder='End' style={smallInputStyle} />
                        </div>
                        <label style={{display:'block',fontSize:'10px',color:mg,marginBottom:'2px',fontWeight:'600'}}>FREQUENCY</label>
                        <select value={ph.frequency} onChange={e => updatePhase(ci, pi, 'frequency', e.target.value)} style={{...smallInputStyle,marginBottom:'6px'}}>
                          {FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        {(ph.frequency === '1x/week' || ph.frequency === '2x/week') && (
                          <select value={ph.day_of_week} onChange={e => updatePhase(ci, pi, 'day_of_week', e.target.value)} style={{...smallInputStyle,marginBottom:'6px'}}>
                            {DAYS.map((d, i) => <option key={i} value={i}>Inject on {d}</option>)}
                          </select>
                        )}
                        <button type='button' onClick={() => setShowAdvanced({...showAdvanced, [ci+'_'+pi]: !showAdvanced[ci+'_'+pi]})} style={{background:'none',border:'none',color:mg,fontSize:'11px',cursor:'pointer',padding:0,marginTop:'4px',textDecoration:'underline'}}>
                          {showAdvanced[ci+'_'+pi] ? 'Hide advanced' : 'Show advanced (syringe units, volume)'}
                        </button>
                        {showAdvanced[ci+'_'+pi] && (
                          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',marginTop:'8px'}}>
                            <input type='number' value={ph.syringe_units} onChange={e => updatePhase(ci, pi, 'syringe_units', e.target.value)} placeholder='Syringe units' style={smallInputStyle} />
                            <input type='number' step='0.01' value={ph.volume_ml} onChange={e => updatePhase(ci, pi, 'volume_ml', e.target.value)} placeholder='Volume mL' style={smallInputStyle} />
                          </div>
                        )}`;

content = content.replace(oldPhaseBlock, newPhaseBlock);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
