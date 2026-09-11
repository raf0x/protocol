const fs = require('fs');

// Create the directory
if (!fs.existsSync('app/share')) fs.mkdirSync('app/share', { recursive: true });
if (!fs.existsSync('app/share/[token]')) fs.mkdirSync('app/share/[token]', { recursive: true });

const page = `import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: share } = await supabase
    .from('shared_protocols')
    .select('protocol_id')
    .eq('token', token)
    .single()

  if (!share) return notFound()

  const { data: protocol } = await supabase
    .from('protocols')
    .select('*, compounds(*, phases(*))')
    .eq('id', share.protocol_id)
    .single()

  if (!protocol) return notFound()

  const startDate = new Date(protocol.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <main style={{minHeight:'100vh',background:'#0c0c14',color:'white',padding:'24px',fontFamily:'Inter,sans-serif'}}>
      <div style={{maxWidth:'520px',margin:'0 auto'}}>

        <div style={{marginBottom:'24px'}}>
          <div style={{fontSize:'13px',color:'#8b8ba7',marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>SHARED PROTOCOL</div>
          <h1 style={{fontSize:'26px',fontWeight:'900',color:'#39ff14',marginBottom:'4px',letterSpacing:'-0.5px'}}>{protocol.name}</h1>
          <p style={{color:'#8b8ba7',fontSize:'13px'}}>Started {startDate}</p>
          {protocol.notes && <p style={{color:'#8b8ba7',fontSize:'13px',marginTop:'6px'}}>{protocol.notes}</p>}
        </div>

        {(protocol.compounds || []).sort((a: any, b: any) => (a.position||0) - (b.position||0)).map((compound: any) => (
          <div key={compound.id} style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'16px',marginBottom:'12px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
              <div>
                <h2 style={{fontSize:'17px',fontWeight:'700',color:'white',marginBottom:'4px'}}>{compound.name}</h2>
                {compound.vial_strength && (
                  <span style={{fontSize:'12px',color:'#8b8ba7'}}>{compound.vial_strength}{compound.vial_unit} vial{compound.bac_water_ml ? ' \u00b7 ' + compound.bac_water_ml + 'mL BAC water' : ''}</span>
                )}
              </div>
            </div>
            <div style={{borderTop:'1px solid #1e1e2e',paddingTop:'12px'}}>
              <div style={{fontSize:'10px',color:'#3d3d5c',fontWeight:'700',letterSpacing:'1px',marginBottom:'8px'}}>PHASE TIMELINE</div>
              {(compound.phases || []).sort((a: any, b: any) => a.start_week - b.start_week).map((phase: any, i: number) => (
                <div key={phase.id || i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid #1e1e2e'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <span style={{fontSize:'10px',fontWeight:'700',padding:'2px 8px',borderRadius:'4px',background:'rgba(57,255,20,0.1)',color:'#39ff14'}}>W{phase.start_week}\u2013W{phase.end_week}</span>
                    <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{phase.dose}{phase.dose_unit}</span>
                  </div>
                  <span style={{fontSize:'12px',color:'#8b8ba7'}}>{phase.frequency}{phase.time_of_day ? ' \u00b7 ' + phase.time_of_day : ''}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{marginTop:'24px',padding:'16px',background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',textAlign:'center'}}>
          <p style={{fontSize:'12px',color:'#3d3d5c',lineHeight:'1.6',margin:'0 0 12px'}}>This is a shared protocol for reference only. Not medical advice.</p>
          <a href='/calculator' style={{color:'#39ff14',fontSize:'13px',fontWeight:'700',textDecoration:'none'}}>Try the reconstitution calculator \u2192</a>
        </div>

      </div>
    </main>
  )
}
`;

fs.writeFileSync('app/share/[token]/page.tsx', page, 'utf8');
console.log('Done! Share page created.');
