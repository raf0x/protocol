import Link from 'next/link'

export default function NotFound() {
  return (
    <main style={{minHeight:'100vh',background:'#0c0c14',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'Inter,sans-serif'}}>
      <div style={{textAlign:'center',maxWidth:'400px'}}>
        <div style={{fontSize:'72px',fontWeight:'900',color:'#39ff14',lineHeight:'1',marginBottom:'8px'}}>404</div>
        <h1 style={{fontSize:'24px',fontWeight:'800',marginBottom:'8px',color:'white'}}>Page not found</h1>
        <p style={{fontSize:'15px',color:'#8b8ba7',marginBottom:'32px',lineHeight:'1.6'}}>This page doesn't exist or was moved. Your data is safe.</p>
        <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
          <Link href='/protocol' style={{background:'#39ff14',color:'#000',textDecoration:'none',fontWeight:'800',padding:'12px 24px',borderRadius:'8px',fontSize:'15px'}}>Go to Dashboard</Link>
          <Link href='/' style={{background:'transparent',color:'#8b8ba7',textDecoration:'none',fontWeight:'600',padding:'12px 24px',borderRadius:'8px',fontSize:'15px',border:'1px solid #1e1e2e'}}>Home</Link>
        </div>
      </div>
    </main>
  )
}