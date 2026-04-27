const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add shareProtocol function after saveEvent function
content = content.replace(
  `  async function loadAll() {`,
  `  async function shareProtocol(protocolId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // Check if share already exists
    const { data: existing } = await supabase
      .from('shared_protocols')
      .select('token')
      .eq('protocol_id', protocolId)
      .eq('user_id', user.id)
      .single()
    if (existing) {
      await navigator.clipboard.writeText(window.location.origin + '/share/' + existing.token)
      alert('Share link copied!')
      return
    }
    // Create new share
    const { data: share } = await supabase
      .from('shared_protocols')
      .insert({ protocol_id: protocolId, user_id: user.id })
      .select('token')
      .single()
    if (share) {
      await navigator.clipboard.writeText(window.location.origin + '/share/' + share.token)
      alert('Share link copied!')
    }
  }

  async function loadAll() {`
);

// Add share button inside the compound tab card after vial status row
content = content.replace(
  `                  <CompoundNotes compoundId={active.id} initialNotes={active.notes || ''} />`,
  `                  <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'flex-end'}}>
                    <button onClick={() => shareProtocol(ap.id)} style={{background:'none',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'6px 12px',color:'var(--color-dim)',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share protocol \u2192</button>
                  </div>
                  <CompoundNotes compoundId={active.id} initialNotes={active.notes || ''} />`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
