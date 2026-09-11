const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Check if createClient import exists
if (!content.includes("import { createClient }")) {
  content = content.replace(
    "import { useState, useEffect } from 'react'",
    "import { useState, useEffect } from 'react'\nimport { createClient } from '../../lib/supabase'"
  );
}

// Add save flow states if not already there
if (!content.includes("showSaveFlow")) {
  content = content.replace(
    "  const [compoundLabel, setCompoundLabel] = useState('')",
    "  const [compoundLabel, setCompoundLabel] = useState('')\n  const [showSaveFlow, setShowSaveFlow] = useState(false)\n  const [isLoggedIn, setIsLoggedIn] = useState(false)\n  const [savingProtocol, setSavingProtocol] = useState(false)\n  const [saveSuccess, setSaveSuccess] = useState(false)\n  const [userId, setUserId] = useState('')"
  );
}

// Add auth check on page load
content = content.replace(
  "  useEffect(() => {\n    const params = new URLSearchParams(window.location.search)",
  "  useEffect(() => {\n    async function checkAuth() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) { setIsLoggedIn(true); setUserId(user.id) } }\n    checkAuth()\n    const params = new URLSearchParams(window.location.search)"
);

// Add saveToProtocol function
content = content.replace(
  "  const activeDose = showCustomDose",
  `  async function saveToProtocol() {
    if (!compoundLabel.trim()) return
    setSavingProtocol(true)
    try {
      const supabase = createClient()
      const todayStr = new Date().toISOString().split('T')[0]
      const { data: protocol } = await supabase.from('protocols').insert({ user_id: userId, name: compoundLabel.trim(), start_date: todayStr }).select().single()
      if (!protocol) { setSavingProtocol(false); return }
      const { data: compound } = await supabase.from('compounds').insert({ protocol_id: protocol.id, user_id: userId, name: compoundLabel.trim(), vial_strength: activeStrength, vial_unit: 'mg', bac_water_ml: activeWater, reconstitution_date: todayStr }).select().single()
      if (!compound) { setSavingProtocol(false); return }
      await supabase.from('phases').insert({ compound_id: compound.id, user_id: userId, name: 'Phase 1', dose: activeDose, dose_unit: 'mg', syringe_units: Math.round(syringeUnits * 10) / 10, volume_ml: Math.round(volumeMl * 1000) / 1000, start_week: 1, end_week: 4, frequency: '1x/week' })
      await supabase.from('protocol_events').insert({ user_id: userId, protocol_id: protocol.id, compound_id: compound.id, date: todayStr, event_type: 'started', description: 'Started ' + compoundLabel.trim() + ' at ' + activeDose + 'mg' })
      setSavingProtocol(false)
      setSaveSuccess(true)
    } catch (e) { console.error(e); setSavingProtocol(false) }
  }

  const activeDose = showCustomDose`
);

// Replace the save to protocol button with the new flow
content = content.replace(
  "<button onClick={() => window.location.href='/protocol?newprotocol=1&dose='+activeDose+'&vial='+activeStrength+'&water='+activeWater} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>",
  "<button onClick={() => setShowSaveFlow(true)} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>"
);

// Add the save flow UI at the end of the results section, before the closing tags
content = content.replace(
  "          <p style={{fontSize:'11px',color:mg,marginTop:'16px',lineHeight:'1.5'}}>For U-100 insulin syringes only. Reference tool. Not medical advice — verify all calculations independently.</p>",
  `          <p style={{fontSize:'11px',color:mg,marginTop:'16px',lineHeight:'1.5'}}>For U-100 insulin syringes only. Reference tool. Not medical advice — verify all calculations independently.</p>

          {hasAll && showSaveFlow && !saveSuccess && isLoggedIn && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'8px'}}>ADD TO YOUR STACK</span>
              {!compoundLabel.trim() && <input value={compoundLabel} onChange={e => setCompoundLabel(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'8px'}} />}
              {compoundLabel.trim() && <input value={compoundLabel} onChange={e => setCompoundLabel(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'8px'}} />}
              <p style={{fontSize:'11px',color:mg,marginBottom:'10px'}}>Creates: {activeDose}mg dose · {activeStrength}mg vial · {activeWater}mL BAC · Weekly</p>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => setShowSaveFlow(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                <button onClick={saveToProtocol} disabled={savingProtocol || !compoundLabel.trim()} style={{flex:2,background:savingProtocol||!compoundLabel.trim()?'#1a3d1a':g,color:savingProtocol||!compoundLabel.trim()?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{savingProtocol ? 'Creating...' : 'Create Protocol'}</button>
              </div>
            </div>
          )}

          {hasAll && showSaveFlow && !isLoggedIn && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd,textAlign:'center'}}>
              <p style={{fontSize:'13px',color:dg,marginBottom:'10px'}}>Sign in to save this to your protocol</p>
              <a href='/auth/login' style={{display:'block',background:g,color:'#000',textDecoration:'none',fontWeight:'700',padding:'12px',borderRadius:'6px',fontSize:'14px',textAlign:'center'}}>Sign in / Create account</a>
            </div>
          )}

          {saveSuccess && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd,textAlign:'center'}}>
              <span style={{color:g,fontSize:'14px',fontWeight:'700'}}>✓ Protocol created!</span>
              <p style={{fontSize:'12px',color:dg,marginTop:'6px'}}>View it on your <a href='/protocol' style={{color:g,textDecoration:'none'}}>Dashboard →</a></p>
            </div>
          )}`
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
