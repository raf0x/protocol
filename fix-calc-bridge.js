const fs = require('fs');
let calc = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Add state for the save-to-protocol flow
calc = calc.replace(
  "  const [showCustomWater, setShowCustomWater] = useState(false)",
  "  const [showCustomWater, setShowCustomWater] = useState(false)\n  const [showSaveFlow, setShowSaveFlow] = useState(false)\n  const [compoundName, setCompoundName] = useState('')\n  const [savingProtocol, setSavingProtocol] = useState(false)\n  const [saveSuccess, setSaveSuccess] = useState(false)"
);

// Add the save function
calc = calc.replace(
  "  const activeDose = showCustomDose",
  `  async function saveToProtocol() {
    if (!compoundName.trim()) return
    setSavingProtocol(true)
    const { createClient } = await import('../lib/supabase')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/auth/login'; return }
    const today = new Date().toISOString().split('T')[0]
    const { data: protocol } = await supabase.from('protocols').insert({ user_id: user.id, name: compoundName.trim(), start_date: today }).select().single()
    if (!protocol) { setSavingProtocol(false); return }
    const { data: compound } = await supabase.from('compounds').insert({ protocol_id: protocol.id, user_id: user.id, name: compoundName.trim(), vial_strength: activeStrength, vial_unit: 'mg', bac_water_ml: activeWater, reconstitution_date: today }).select().single()
    if (!compound) { setSavingProtocol(false); return }
    await supabase.from('phases').insert({ compound_id: compound.id, user_id: user.id, name: 'Phase 1', dose: activeDose, dose_unit: 'mg', syringe_units: syringeUnits, volume_ml: volumeMl, start_week: 1, end_week: 4, frequency: '1x/week' })
    await supabase.from('protocol_events').insert({ user_id: user.id, protocol_id: protocol.id, compound_id: compound.id, date: today, event_type: 'started', description: 'Started ' + compoundName.trim() + ' at ' + activeDose + 'mg' })
    setSavingProtocol(false)
    setSaveSuccess(true)
  }

  const activeDose = showCustomDose`
);

// Replace the save button with the new flow
calc = calc.replace(
  "                <a href={'/protocol?dose='+activeDose+'&vial='+activeStrength+'&water='+activeWater+'&unit='+((activeDose||0)>=1?'mg':'mcg')} style={{flex:1,background:g,color:'#000',textDecoration:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>Save to protocol →</a>",
  "<button onClick={() => setShowSaveFlow(true)} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>"
);

// Add the save flow UI right before the closing of the confidence block
calc = calc.replace(
  "            </div>\n          )}\n",
  `            </div>
          )}

          {hasAll && showSaveFlow && !saveSuccess && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'8px'}}>ADD TO YOUR STACK</span>
              <input value={compoundName} onChange={e => setCompoundName(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'8px'}} />
              <p style={{fontSize:'11px',color:mg,marginBottom:'10px'}}>Creates a protocol with {activeDose}mg dose, {activeStrength}mg vial, {activeWater}mL BAC water. You can edit phases later.</p>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => setShowSaveFlow(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                <button onClick={saveToProtocol} disabled={savingProtocol || !compoundName.trim()} style={{flex:2,background:savingProtocol?'#1a3d1a':g,color:savingProtocol?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{savingProtocol ? 'Creating...' : 'Create Protocol'}</button>
              </div>
            </div>
          )}

          {saveSuccess && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd,textAlign:'center'}}>
              <span style={{color:g,fontSize:'14px',fontWeight:'700'}}>✓ Protocol created!</span>
              <p style={{fontSize:'12px',color:dg,marginTop:'6px'}}>View it on your <a href='/protocol' style={{color:g,textDecoration:'none'}}>Dashboard →</a></p>
            </div>
          )}
`
);

fs.writeFileSync('app/calculator/page.tsx', calc, 'utf8');
console.log('Done');
