import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const dose = parseFloat(searchParams.get('dose') || '0')
  const vial = parseFloat(searchParams.get('vial') || '0')
  const water = parseFloat(searchParams.get('water') || '0')

  let units = 0, volumeMl = 0, concentration = 0
  if (dose && vial && water) {
    const totalMcg = vial * 1000
    concentration = totalMcg / water
    volumeMl = (dose * 1000) / concentration
    units = volumeMl * 100
  }

  return new ImageResponse(
    (
      <div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',background:'#0a0a0f',padding:'60px',fontFamily:'monospace',color:'white'}}>
        <div style={{display:'flex',alignItems:'center',gap:'16px',marginBottom:'40px'}}>
          <span style={{fontSize:'36px',fontWeight:900,color:'#39ff14',letterSpacing:'2px'}}>PROTOCOL</span>
          <span style={{fontSize:'20px',color:'#3d3d5c'}}>Peptide Calculator</span>
        </div>
        {dose > 0 ? (
          <div style={{display:'flex',flexDirection:'column',gap:'24px',flex:1}}>
            <div style={{display:'flex',gap:'40px'}}>
              <div style={{display:'flex',flexDirection:'column'}}>
                <span style={{fontSize:'14px',color:'#3d3d5c',letterSpacing:'2px',marginBottom:'8px'}}>DOSE</span>
                <span style={{fontSize:'48px',fontWeight:900,color:'white'}}>{dose}mg</span>
              </div>
              <div style={{display:'flex',flexDirection:'column'}}>
                <span style={{fontSize:'14px',color:'#3d3d5c',letterSpacing:'2px',marginBottom:'8px'}}>VIAL</span>
                <span style={{fontSize:'48px',fontWeight:900,color:'white'}}>{vial}mg</span>
              </div>
              <div style={{display:'flex',flexDirection:'column'}}>
                <span style={{fontSize:'14px',color:'#3d3d5c',letterSpacing:'2px',marginBottom:'8px'}}>WATER</span>
                <span style={{fontSize:'48px',fontWeight:900,color:'white'}}>{water}mL</span>
              </div>
            </div>
            <div style={{display:'flex',flexDirection:'column',background:'#12121a',border:'2px solid #39ff14',borderRadius:'16px',padding:'32px'}}>
              <span style={{fontSize:'14px',color:'#39ff14',letterSpacing:'2px',marginBottom:'8px'}}>DRAW SYRINGE TO</span>
              <span style={{fontSize:'72px',fontWeight:900,color:'#39ff14'}}>{units.toFixed(1)} units</span>
              <span style={{fontSize:'20px',color:'#8b8ba7',marginTop:'8px'}}>{volumeMl.toFixed(3)} mL · {concentration.toFixed(0)} mcg/mL</span>
            </div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1}}>
            <span style={{fontSize:'36px',fontWeight:900,color:'#39ff14',marginBottom:'16px'}}>Peptide Calculator</span>
            <span style={{fontSize:'24px',color:'#8b8ba7'}}>Exact syringe units. No math errors.</span>
          </div>
        )}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'24px'}}>
          <span style={{fontSize:'16px',color:'#3d3d5c'}}>mypepprotocol.app/calculator</span>
          <span style={{fontSize:'14px',color:'#39ff14',letterSpacing:'1px'}}>FREE · NO SIGNUP</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}