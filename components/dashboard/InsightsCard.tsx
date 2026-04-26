'use client'
// InsightsCard � computed text insights from journal data

type Insight = { text: string; accent: string }

type Props = {
  insights: Insight[]
}

export default function InsightsCard({ insights }: Props) {
  if (insights.length === 0) return null
  return (
    <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
      <div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>
      {insights.map((ins, i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'var(--color-text)'}}>
          <span style={{color:ins.accent,fontWeight:'700'}}>→</span>
          <span>{ins.text}</span>
        </div>
      ))}
    </div>
  )
}
