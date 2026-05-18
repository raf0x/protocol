'use client'

type Props = {
  activeProtocols: any[]
  logs: Record<string, any>
}

export default function TodayCard({ activeProtocols, logs }: Props) {
  const today = new Date().toISOString().split('T')[0]
  
  const dueToday = activeProtocols.flatMap(p => 
    (p.compounds || []).map((c: any) => {
      const isLogged = !!logs[c.id]?.taken
      const phase = c.phases?.[0]
      return { name: c.name, logged: isLogged, dose: phase?.dose, unit: phase?.dose_unit }
    })
  )

  const remaining = dueToday.filter(d => !d.logged)
  const completed = dueToday.filter(d => d.logged)

  return (
    <div style={{
      background: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '16px',
      padding: '20px',
      marginBottom: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)', letterSpacing: '1px' }}>
          TODAY'S PROTOCOL
        </h3>
        <div style={{ fontSize: '13px', fontWeight: '700', color: remaining.length === 0 ? '#39ff14' : 'var(--color-muted)' }}>
          {completed.length}/{dueToday.length}
        </div>
      </div>

      {remaining.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>✓</div>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#39ff14' }}>All done for today</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {remaining.map((item, i) => (
            <div key={i} style={{
              background: 'var(--color-surface)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--color-text)' }}>
                {item.name}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-dim)' }}>
                {item.dose}{item.unit}
              </span>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--color-muted)', marginBottom: '6px' }}>COMPLETED</div>
          {completed.map((item, i) => (
            <div key={i} style={{ fontSize: '12px', color: 'var(--color-dim)', opacity: 0.6 }}>
              ✓ {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
