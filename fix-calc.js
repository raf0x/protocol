const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

const oldSections = `        {/* Dose section */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'12px'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'}}>DOSE OF PEPTIDE (mg)</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            {DOSE_PRESETS.map(v => (
              <PresetBtn key={v} value={v} active={!showCustomDose && dose===v} onClick={() => { setDose(v); setShowCustomDose(false) }} />
            ))}
          </div>
          <button onClick={() => setShowCustomDose(!showCustomDose)} style={{fontSize:'12px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
            {showCustomDose ? 'Use presets' : 'Enter custom value'}
          </button>
          {showCustomDose && (
            <input type='number' value={customDose} onChange={e => setCustomDose(e.target.value)} placeholder='e.g. 0.3' style={{marginTop:'10px',width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
          )}
        </div>

        {/* Strength section */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'12px'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'}}>VIAL STRENGTH (mg)</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            {STRENGTH_PRESETS.map(v => (
              <PresetBtn key={v} value={v} active={!showCustomStrength && strength===v} onClick={() => { setStrength(v); setShowCustomStrength(false) }} />
            ))}
          </div>
          <button onClick={() => setShowCustomStrength(!showCustomStrength)} style={{fontSize:'12px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
            {showCustomStrength ? 'Use presets' : 'Enter custom value'}
          </button>
          {showCustomStrength && (
            <input type='number' value={customStrength} onChange={e => setCustomStrength(e.target.value)} placeholder='e.g. 7' style={{marginTop:'10px',width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
          )}
        </div>

        {/* Water section */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'24px'}}>
          <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'}}>BACTERIOSTATIC WATER (mL)</h2>
          <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginBottom:'12px'}}>
            {WATER_PRESETS.map(v => (
              <PresetBtn key={v} value={v} active={!showCustomWater && water===v} onClick={() => { setWater(v); setShowCustomWater(false) }} />
            ))}
          </div>
          <button onClick={() => setShowCustomWater(!showCustomWater)} style={{fontSize:'12px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>
            {showCustomWater ? 'Use presets' : 'Enter custom value'}
          </button>
          {showCustomWater && (
            <input type='number' value={customWater} onChange={e => setCustomWater(e.target.value)} placeholder='e.g. 1.2' style={{marginTop:'10px',width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
          )}
        </div>`;

const newSections = `        {/* All inputs — compact single card */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px',display:'flex',flexDirection:'column',gap:'14px'}}>

          {/* Dose */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>DOSE (mg)</span>
              <button onClick={() => setShowCustomDose(!showCustomDose)} style={{fontSize:'11px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>{showCustomDose?'Use presets':'Custom'}</button>
            </div>
            {showCustomDose
              ? <input type='number' value={customDose} onChange={e => setCustomDose(e.target.value)} placeholder='e.g. 0.3' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
              : <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{DOSE_PRESETS.map(v => <PresetBtn key={v} value={v} active={!showCustomDose && dose===v} onClick={() => { setDose(v); setShowCustomDose(false) }} />)}</div>
            }
          </div>

          <div style={{height:'1px',background:bd}} />

          {/* Vial strength */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>VIAL STRENGTH (mg)</span>
              <button onClick={() => setShowCustomStrength(!showCustomStrength)} style={{fontSize:'11px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>{showCustomStrength?'Use presets':'Custom'}</button>
            </div>
            {showCustomStrength
              ? <input type='number' value={customStrength} onChange={e => setCustomStrength(e.target.value)} placeholder='e.g. 7' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
              : <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{STRENGTH_PRESETS.map(v => <PresetBtn key={v} value={v} active={!showCustomStrength && strength===v} onClick={() => { setStrength(v); setShowCustomStrength(false) }} />)}</div>
            }
          </div>

          <div style={{height:'1px',background:bd}} />

          {/* BAC water */}
          <div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>BAC WATER (mL)</span>
              <button onClick={() => setShowCustomWater(!showCustomWater)} style={{fontSize:'11px',color:mg,background:'none',border:'none',cursor:'pointer',padding:0,textDecoration:'underline'}}>{showCustomWater?'Use presets':'Custom'}</button>
            </div>
            {showCustomWater
              ? <input type='number' value={customWater} onChange={e => setCustomWater(e.target.value)} placeholder='e.g. 1.2' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none'}} />
              : <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>{WATER_PRESETS.map(v => <PresetBtn key={v} value={v} active={!showCustomWater && water===v} onClick={() => { setWater(v); setShowCustomWater(false) }} />)}</div>
            }
          </div>

        </div>`;

if (content.includes(oldSections)) {
  content = content.replace(oldSections, newSections);
  fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
  console.log('Done!');
} else {
  console.log('NOT FOUND');
}
