import { ImageResponse } from 'next/og'

export const alt = 'MyPepProtocol'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div style={{display:'flex',flexDirection:'column',width:'100%',height:'100%',background:'#0a0a0f',padding:'80px',fontFamily:'monospace',color:'white'}}>
        <div style={{display:'flex',flexDirection:'column',flex:1,justifyContent:'center'}}>
          <span style={{fontSize:'72px',fontWeight:900,color:'white',letterSpacing:'1px'}}>
            MyPep<span style={{color:'#39ff14'}}>Protocol</span>
          </span>
          <span style={{fontSize:'32px',color:'#8b8ba7',marginTop:'24px'}}>
            Private longitudinal health and protocol tracking.
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center'}}>
          <span style={{fontSize:'20px',color:'#3d3d5c'}}>mypepprotocol.app</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
