'use client'
import { useMemo } from 'react'

type Props = {
  activeProtocols: any[]
  allLogs: any[]
  totalLost: string | null
}

export default function ProtocolTimeline({ activeProtocols, allLogs, totalLost }: Props) {
  const timeline = useMemo(() => {
    if (!activeProtocols.length) return null

    const protocol = activeProtocols[0]
    const startDate = new Date(protocol.start_date + 'T00:00:00')
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const daysIn = Math.max(0, Math.floor((today.getTime() - startDate.getTime()) / 86400000))
    const currentWeek = Math.max(1, Math.floor(daysIn / 7) + 1)

    // Get all phases from all compounds, dedupe by week range
    const allPhases = activeProtocols.flatMap(p => 
      (p.compounds || []).flatMap((c: any) => 
        (c.phases || []).map((ph: any) => ({
          startWeek: ph.start_week,
          endWeek: ph.end_week,
          compound: c.name,
          dose: ph.dose,
          unit: ph.dose_unit
        }))
      )
    )

    // Group into unique week ranges
    const phaseRanges = Array.from(
      new Set(allPhases.map(p => `${p.startWeek}-${p.endWeek}`))
    ).map(range => {
      const [start, end] = range.split('-').map(Number)
      const phasesInRange = allPhases.filter(p => p.startWeek === start && p.endWeek === end)
      return { startWeek: start, endWeek: end, compounds: phasesInRange }
    }).sort((a, b) => a.startWeek - b.startWeek)

    // Calculate adherence by week
    const weeklyAdherence: Record<number, number> = {}
    for (let week = 1; week <= currentWeek; week++) {
      const weekStart = new Date(startDate)
      weekStart.setDate(startDate.getDate() + (week - 1) * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 6)

      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + i)
        return d.toISOString().split('T')[0]
      }).filter(d => new Date(d + 'T00:00:00').getTime() <= today.getTime())

      const expectedLogs = weekDates.length * activeProtocols.flatMap(p => p.compounds || []).length
      const actualLogs = allLogs.filter(l => weekDates.includes(l.date) && l.taken).length
      weeklyAdherence[week] = expectedLogs > 0 ? (actualLogs / expectedLogs) * 100 : 0
    }

    // Define milestones
    const milestones = [
      { week: 2, label: 'Adjustment period', icon: '🎯' },
      { week: 4, label: 'Early progress visible', icon: '📊' },
      { week: 8, label: 'Momentum building', icon: '🚀' },
      { week: 12, label: 'Results solidifying', icon: '💪' }
    ].filter(m => m.week <= (phaseRanges[phaseRanges.length - 1]?.endWeek || 12))

    return { phaseRanges, currentWeek, milestones, weeklyAdherence, daysIn, totalWeeks: phaseRanges[phaseRanges.length - 1]?.endWeek || 12 }
  }, [activeProtocols, allLogs])

  if (!timeline) return null

  const { phaseRanges, currentWeek, milestones, weeklyAdherence, daysIn, totalWeeks } = timeline
  const progress = Math.min(100, (currentWeek / totalWeeks) * 100)

  return (
    <div style={{
      background: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '20px'
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text)', letterSpacing: '1px', marginBottom: '8px' }}>
          PROTOCOL TIMELINE
        </h3>
        <div style={{ fontSize: '13px', color: 'var(--color-dim)' }}>
          Week {currentWeek} of {totalWeeks} • Day {daysIn + 1}
        </div>
      </div>

      {/* Progress bar with phases */}
      <div style={{ position: 'relative', marginBottom: '32px' }}>
        {/* Base track */}
        <div style={{
          height: '8px',
          background: 'var(--color-surface)',
          borderRadius: '4px',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Progress fill */}
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #39ff14, #6c63ff)',
            borderRadius: '4px',
            transition: 'width 0.5s ease'
          }} />
        </div>

        {/* Current position marker */}
        <div style={{
          position: 'absolute',
          left: `${progress}%`,
          top: '-8px',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px'
        }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: '#39ff14',
            border: '3px solid var(--color-card)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: '900',
            color: '#000',
            boxShadow: '0 0 12px rgba(57,255,20,0.5)'
          }}>
            ●
          </div>
          <div style={{
            fontSize: '10px',
            fontWeight: '700',
            color: '#39ff14',
            background: 'var(--color-card)',
            padding: '2px 6px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(57,255,20,0.3)'
          }}>
            You are here
          </div>
        </div>

        {/* Week markers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
          {Array.from({ length: Math.ceil(totalWeeks / 4) + 1 }, (_, i) => i * 4).map(week => (
            <div key={week} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: week <= currentWeek ? 'var(--color-text)' : 'var(--color-dim)', fontWeight: '600' }}>
                Wk {week || 1}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phases */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-muted)', letterSpacing: '1px', marginBottom: '12px' }}>
          PHASES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {phaseRanges.map((phase, i) => {
            const isActive = currentWeek >= phase.startWeek && currentWeek <= phase.endWeek
            const isPast = currentWeek > phase.endWeek
            return (
              <div key={i} style={{
                background: isActive ? 'rgba(57,255,20,0.08)' : isPast ? 'rgba(108,99,255,0.05)' : 'var(--color-surface)',
                border: `1px solid ${isActive ? 'rgba(57,255,20,0.3)' : 'var(--color-border)'}`,
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: '700', color: isActive ? '#39ff14' : 'var(--color-text)', marginBottom: '2px' }}>
                    {isPast ? '✓ ' : isActive ? '→ ' : ''}Week {phase.startWeek}-{phase.endWeek}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-dim)' }}>
                    {phase.compounds.length} compound{phase.compounds.length !== 1 ? 's' : ''}
                  </div>
                </div>
                {isActive && (
                  <div style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: '#39ff14',
                    background: 'rgba(57,255,20,0.15)',
                    padding: '3px 8px',
                    borderRadius: '12px'
                  }}>
                    ACTIVE
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Milestones */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-muted)', letterSpacing: '1px', marginBottom: '12px' }}>
          MILESTONES
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {milestones.map((milestone, i) => {
            const reached = currentWeek >= milestone.week
            return (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: reached ? 1 : 0.4
              }}>
                <div style={{ fontSize: '16px' }}>{reached ? '✓' : milestone.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: reached ? '#39ff14' : 'var(--color-text)' }}>
                    {milestone.label}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--color-dim)' }}>Week {milestone.week}</div>
                </div>
                {reached && weeklyAdherence[milestone.week] !== undefined && (
                  <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--color-dim)' }}>
                    {Math.round(weeklyAdherence[milestone.week])}% adherence
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Weekly adherence sparkline */}
      <div>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--color-muted)', letterSpacing: '1px', marginBottom: '12px' }}>
          WEEKLY ADHERENCE
        </div>
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '40px' }}>
          {Array.from({ length: currentWeek }, (_, i) => i + 1).map(week => {
            const adherence = weeklyAdherence[week] || 0
            const height = Math.max(4, (adherence / 100) * 40)
            const color = adherence >= 85 ? '#39ff14' : adherence >= 50 ? '#fbbf24' : '#ff6b6b'
            return (
              <div key={week} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: '100%',
                  height: `${height}px`,
                  background: color,
                  borderRadius: '2px',
                  opacity: week === currentWeek ? 1 : 0.6,
                  transition: 'height 0.3s ease'
                }} />
                {week % 2 === 1 && (
                  <div style={{ fontSize: '9px', color: 'var(--color-dim)', fontWeight: '600' }}>W{week}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
