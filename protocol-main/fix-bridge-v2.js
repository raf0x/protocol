const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Remove all the save flow states
content = content.replace(
  "  const [showSaveFlow, setShowSaveFlow] = useState(false)\n  const [compoundName, setCompoundName] = useState('')\n  const [savingProtocol, setSavingProtocol] = useState(false)\n  const [saveSuccess, setSaveSuccess] = useState(false)\n  const [needsLogin, setNeedsLogin] = useState(false)",
  ""
);

// Remove the saveToProtocol function entirely
content = content.replace(
  /  async function saveToProtocol\(\) \{[\s\S]*?\n  const activeDose = showCustomDose/,
  "  const activeDose = showCustomDose"
);

// Remove the save flow UI blocks
content = content.replace(
  /          \{hasAll && showSaveFlow && !saveSuccess[\s\S]*?\{saveSuccess && \([\s\S]*?\)}\n/,
  ""
);

// Also remove the needsLogin block if it exists
content = content.replace(
  /          \{needsLogin && \([\s\S]*?\)}\n\n/,
  ""
);

// Replace the save button with a simple link that passes params
content = content.replace(
  "<button onClick={async () => { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user) { setShowSaveFlow(true) } else { setShowSaveFlow(true) } }} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>",
  "<a href={'/protocol?newprotocol=1&dose='+activeDose+'&vial='+activeStrength+'&water='+activeWater} style={{flex:1,background:g,color:'#000',textDecoration:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>Save to protocol →</a>"
);

// Remove the supabase import since calculator no longer needs it
content = content.replace(
  "import { createClient } from '../../lib/supabase'\n",
  ""
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Calculator cleaned');

// Now update Dashboard to handle the prefill params
let dash = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Remove the old broken prefill useEffect if it exists
dash = dash.replace(
  /  useEffect\(\(\) => \{\n    loadAll\(\)\n    const params = new URLSearchParams[\s\S]*?\n  \}, \[\]\)/,
  "  useEffect(() => { loadAll() }, [])"
);

// Add prefill state
dash = dash.replace(
  "  const [saved, setSaved] = useState(false)",
  "  const [saved, setSaved] = useState(false)\n  const [showNewProtocol, setShowNewProtocol] = useState(false)\n  const [newName, setNewName] = useState('')\n  const [prefillDose, setPrefillDose] = useState('')\n  const [prefillVial, setPrefillVial] = useState('')\n  const [prefillWater, setPrefillWater] = useState('')\n  const [creatingProtocol, setCreatingProtocol] = useState(false)\n  const [createSuccess, setCreateSuccess] = useState(false)"
);

// Check URL params after loadAll
dash = dash.replace(
  "  useEffect(() => { loadAll() }, [])",
  `  useEffect(() => {
    loadAll()
    const params = new URLSearchParams(window.location.search)
    if (params.get('newprotocol') === '1') {
      setPrefillDose(params.get('dose') || '')
      setPrefillVial(params.get('vial') || '')
      setPrefillWater(params.get('water') || '')
      setShowNewProtocol(true)
      window.history.replaceState({}, '', '/protocol')
    }
  }, [])`
);

// Add createProtocol function
dash = dash.replace(
  "  async function loadAll() {",
  `  async function createProtocolFromCalc() {
    if (!newName.trim()) return
    setCreatingProtocol(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: protocol } = await supabase.from('protocols').insert({ user_id: user.id, name: newName.trim(), start_date: todayStr }).select().single()
    if (!protocol) { setCreatingProtocol(false); return }
    const { data: compound } = await supabase.from('compounds').insert({ protocol_id: protocol.id, user_id: user.id, name: newName.trim(), vial_strength: prefillVial ? parseFloat(prefillVial) : null, vial_unit: 'mg', bac_water_ml: prefillWater ? parseFloat(prefillWater) : null, reconstitution_date: todayStr }).select().single()
    if (!compound) { setCreatingProtocol(false); return }
    await supabase.from('phases').insert({ compound_id: compound.id, user_id: user.id, name: 'Phase 1', dose: parseFloat(prefillDose), dose_unit: 'mg', start_week: 1, end_week: 4, frequency: '1x/week' })
    await supabase.from('protocol_events').insert({ user_id: user.id, protocol_id: protocol.id, compound_id: compound.id, date: todayStr, event_type: 'started', description: 'Started ' + newName.trim() + ' at ' + prefillDose + 'mg' })
    setCreatingProtocol(false)
    setCreateSuccess(true)
    setShowNewProtocol(false)
    loadAll()
  }

  async function loadAll() {`
);

// Insert the new protocol form UI right after the subtitle
dash = dash.replace(
  "        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>You're building something. Keep going.</p>",
  `        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>You're building something. Keep going.</p>

        {createSuccess && (
          <div style={{background:'rgba(57,255,20,0.1)',border:'1px solid rgba(57,255,20,0.3)',borderRadius:'12px',padding:'16px',marginBottom:'16px',textAlign:'center'}}>
            <span style={{color:g,fontSize:'14px',fontWeight:'700'}}>✓ Protocol created!</span>
            <p style={{fontSize:'12px',color:dg,marginTop:'4px'}}>It's now in your active stack below.</p>
          </div>
        )}

        {showNewProtocol && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>CREATE FROM CALCULATOR</span>
            <p style={{fontSize:'12px',color:dg,marginBottom:'12px'}}>Dose: {prefillDose}mg · Vial: {prefillVial}mg · BAC: {prefillWater}mL</p>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}} />
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={() => setShowNewProtocol(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
              <button onClick={createProtocolFromCalc} disabled={creatingProtocol || !newName.trim()} style={{flex:2,background:creatingProtocol?'#1a3d1a':g,color:creatingProtocol?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{creatingProtocol ? 'Creating...' : 'Create Protocol'}</button>
            </div>
          </div>
        )}`
);

fs.writeFileSync('app/protocol/page.tsx', dash, 'utf8');
console.log('Dashboard updated');
console.log('All done');
