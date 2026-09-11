const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');

// Add ml wizard state after existing state declarations
content = content.replace(
  `  const [showNewVial, setShowNewVial] = useState(false)`,
  `  const [showNewVial, setShowNewVial] = useState(false)
  const [showMlWizard, setShowMlWizard] = useState(false)
  const [wizardMethod, setWizardMethod] = useState<'units'|'mg'|'iu'|null>(null)
  const [wizardDose, setWizardDose] = useState('')
  const [wizardVialStrength, setWizardVialStrength] = useState('')
  const [wizardBacWater, setWizardBacWater] = useState(bacWaterMl ? String(bacWaterMl) : '')`
);

// Add wizard calculation
content = content.replace(
  `  async function saveMl() {`,
  `  function calcMlFromWizard(): number | null {
    const dose = parseFloat(wizardDose)
    const vs = parseFloat(wizardVialStrength)
    const bac = parseFloat(wizardBacWater)
    if (isNaN(dose) || dose <= 0) return null
    if (wizardMethod === 'units') return dose / 100
    if (wizardMethod === 'mg' && vs > 0 && bac > 0) return (dose * bac) / vs
    if (wizardMethod === 'iu' && vs > 0 && bac > 0) return dose / (vs / bac)
    return null
  }

  async function saveMlFromWizard() {
    const val = calcMlFromWizard()
    if (val === null || val <= 0) return
    setMlPerDose(val); setSaving(true)
    const supabase = createClient()
    await supabase.from('compounds').update({ ml_per_dose: parseFloat(val.toFixed(4)) }).eq('id', compoundId)
    setSaving(false)
    try { localStorage.setItem('vial_inventory_' + compoundId + '_ml', String(val)); window.dispatchEvent(new Event('doses_updated')) } catch(e) {}
    setShowMlWizard(false); setWizardMethod(null); setWizardDose('')
  }

  async function saveMl() {`
);

// Replace the "Set now" button to open wizard instead
content = content.replace(
  `            <button onClick={() => { setEditingMl(true); setMlInput(mlPerDose !== null ? String(mlPerDose) : '') }} style={{background: mlPerDose === null ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)',border:'1px solid '+(mlPerDose === null ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'),borderRadius:'6px',padding:'5px 10px',color: mlPerDose === null ? '#f97316' : 'rgba(255,255,255,0.5)',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>{mlPerDose === null ? 'Set now' : 'Edit'}</button>`,
  `            <button onClick={() => { setShowMlWizard(true); setWizardMethod(null); setWizardDose(''); setWizardBacWater(bacWaterMl ? String(bacWaterMl) : '') }} style={{background: mlPerDose === null ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.06)',border:'1px solid '+(mlPerDose === null ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.1)'),borderRadius:'6px',padding:'5px 10px',color: mlPerDose === null ? '#f97316' : 'rgba(255,255,255,0.5)',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>{mlPerDose === null ? 'Set now' : 'Edit'}</button>`
);

// Add wizard modal before the closing return div
content = content.replace(
  `      {showNewVial && (`,
  `      {showMlWizard && (
        <div style={{background:'rgba(0,0,0,0.85)',position:'fixed',top:0,left:0,right:0,bottom:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
          <div style={{background:'#1a1a2e',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'16px',padding:'24px',width:'100%',maxWidth:'380px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',marginBottom:'8px'}}>DOSE CALCULATOR</div>
            <h3 style={{fontSize:'18px',fontWeight:'800',color:'white',marginBottom:'4px'}}>{compoundName}</h3>
            <p style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginBottom:'20px'}}>How do you measure your dose?</p>

            {!wizardMethod && (
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <button onClick={() => setWizardMethod('units')} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'14px',color:'white',fontSize:'14px',fontWeight:'600',cursor:'pointer',textAlign:'left'}}>
                  <div style={{fontWeight:'700',marginBottom:'2px'}}>Syringe units</div>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>The numbers printed on my needle (10, 20, 50...)</div>
                </button>
                <button onClick={() => setWizardMethod('mg')} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'14px',color:'white',fontSize:'14px',fontWeight:'600',cursor:'pointer',textAlign:'left'}}>
                  <div style={{fontWeight:'700',marginBottom:'2px'}}>Milligrams (mg)</div>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>My dose is written as 0.5mg, 1mg, 2mg...</div>
                </button>
                <button onClick={() => setWizardMethod('iu')} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'10px',padding:'14px',color:'white',fontSize:'14px',fontWeight:'600',cursor:'pointer',textAlign:'left'}}>
                  <div style={{fontWeight:'700',marginBottom:'2px'}}>International Units (IU)</div>
                  <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)'}}>My dose is written as 250 IU, 500 IU... (common for HCG)</div>
                </button>
              </div>
            )}

            {wizardMethod && (() => {
              const ml = calcMlFromWizard()
              const needsVial = wizardMethod === 'mg' || wizardMethod === 'iu'
              return (
                <div>
                  <button onClick={() => setWizardMethod(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',fontSize:'12px',padding:0,marginBottom:'16px'}}>\u2190 Back</button>
                  <label style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>
                    {wizardMethod === 'units' ? 'HOW MANY UNITS DO YOU DRAW?' : wizardMethod === 'mg' ? 'WHAT IS YOUR DOSE IN mg?' : 'WHAT IS YOUR DOSE IN IU?'}
                  </label>
                  <input type='number' step='any' value={wizardDose} onChange={e => setWizardDose(e.target.value)} placeholder={wizardMethod === 'units' ? 'e.g. 60' : wizardMethod === 'mg' ? 'e.g. 2' : 'e.g. 500'} style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'8px',padding:'12px',color:'white',fontSize:'16px',boxSizing:'border-box',marginBottom:'12px'}} autoFocus />
                  {needsVial && (
                    <>
                      <label style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>VIAL STRENGTH ({wizardMethod === 'mg' ? 'mg' : 'IU'})</label>
                      <input type='number' step='any' value={wizardVialStrength} onChange={e => setWizardVialStrength(e.target.value)} placeholder={wizardMethod === 'mg' ? 'e.g. 10' : 'e.g. 10000'} style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'8px',padding:'12px',color:'white',fontSize:'16px',boxSizing:'border-box',marginBottom:'12px'}} />
                      <label style={{fontSize:'11px',color:'rgba(255,255,255,0.4)',fontWeight:'600',letterSpacing:'1px',display:'block',marginBottom:'4px'}}>BAC WATER ADDED (mL)</label>
                      <input type='number' step='any' value={wizardBacWater} onChange={e => setWizardBacWater(e.target.value)} placeholder='e.g. 3' style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'8px',padding:'12px',color:'white',fontSize:'16px',boxSizing:'border-box',marginBottom:'12px'}} />
                    </>
                  )}
                  {ml !== null && (
                    <div style={{background:'rgba(57,255,20,0.08)',border:'1px solid rgba(57,255,20,0.3)',borderRadius:'10px',padding:'14px',marginBottom:'16px',textAlign:'center'}}>
                      <div style={{fontSize:'11px',color:'rgba(57,255,20,0.7)',fontWeight:'600',letterSpacing:'1px',marginBottom:'4px'}}>YOUR DOSE EQUALS</div>
                      <div style={{fontSize:'28px',fontWeight:'900',color:'#39ff14'}}>{ml.toFixed(2)} mL</div>
                      <div style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginTop:'4px'}}>This will be saved for accurate vial tracking</div>
                    </div>
                  )}
                  <div style={{display:'flex',gap:'8px'}}>
                    <button onClick={() => setShowMlWizard(false)} style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'8px',padding:'12px',color:'rgba(255,255,255,0.5)',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
                    <button onClick={saveMlFromWizard} disabled={ml === null || saving} style={{flex:2,background:ml !== null ? '#39ff14' : 'rgba(255,255,255,0.1)',color:ml !== null ? '#000' : 'rgba(255,255,255,0.3)',border:'none',borderRadius:'8px',padding:'12px',fontSize:'14px',fontWeight:'800',cursor:ml !== null ? 'pointer' : 'default'}}>{saving ? 'Saving...' : 'Save ' + (ml !== null ? ml.toFixed(2) + ' mL' : '')}</button>
                  </div>
                </div>
              )
            })()}

            {!wizardMethod && <button onClick={() => setShowMlWizard(false)} style={{width:'100%',background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:'13px',marginTop:'16px'}}>Cancel</button>}
          </div>
        </div>
      )}

      {showNewVial && (`
);

fs.writeFileSync('components/dashboard/VialInventory.tsx', content, 'utf8');
console.log('Done!');
