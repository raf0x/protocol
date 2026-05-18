'use client'
import { useEffect, useState } from 'react'

type Insight = {
  icon: string
  text: string
  type: 'positive' | 'neutral' | 'warning'
}

type Props = {
  allLogs: any[]
  activeProtocols: any[]
  totalLost: string | null
}

export default function InsightCards({ allLogs, activeProtocols, totalLost }: Props) {
  const [insights, setInsights] = useState<Insight[]>([])

  useEffect(() => {
    const generated: Insight[] = []

    // Adherence insight
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return d.toISOString().split('T')[0]
    })
    const logsLast7 = allLogs.filter(l => last7Days.includes(l.date) && l.taken)
    const adherenceRate = logsLast7.length / (activeProtocols.flatMap(p => p.compounds || []).length * 7)
    
    if (adherenceRate >= 0.85) {
      generated.push({ icon: '🎯', text: 'Strong adherence this week', type: 'positive' })
    } else if (adherenceRate < 0.5) {
      generated.push({ icon: '⚠️', text: 'Adherence dropping — stay consistent', type: 'warning' })
    }

    // Weight trend insight
    if (totalLost && parseFloat(totalLost) > 0) {
      const lbs = parseFloat(totalLost)
      if (lbs >= 5) {
        generated.push({ icon: '📉', text: `Down ${lbs} lbs — momentum building`, type: 'positive' })
      } else {
        generated.push({ icon: '📊', text: `Down ${lbs} lbs — early progress`, type: 'neutral' })
      }
    }

    // Consistency pattern
    const dayOfWeekCounts: Record<number, number> = {}
    logsLast7.forEach(log => {
      const day = new Date(log.date + 'T00:00:00').getDay()
      dayOfWeekCounts[day] = (dayOfWeekCounts[day] || 0) + 1
    })
    const topDay = Object.entries(dayOfWeekCounts).sort((a, b) => b[1] - a[1])[0]
    if (topDay && topDay[1] >= 2) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      generated.push({ icon: '📅', text: `Most consistent on ${dayNames[parseInt(topDay[0])]}`, type: 'neutral' })
    }

    setInsights(generated.slice(0, 3)) // Max 3 insights
  }, [allLogs, activeProtocols, totalLost])

  if (insights.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
      {insights.map((insight, i) => {
        const colors = {
          positive: { bg: 'rgba(57,255,20,0.08)', border: 'rgba(57,255,20,0.3)', text: '#39ff14' },
          neutral: { bg: 'rgba(108,99,255,0.08)', border: 'rgba(108,99,255,0.3)', text: '#6c63ff' },
          warning: { bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.3)', text: '#fbbf24' }
        }[insight.type]

        return (
          <div
            key={i}
            style={{
              background: colors.bg,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: '600',
              color: colors.text
            }}
          >
            <span style={{ fontSize: '14px' }}>{insight.icon}</span>
            <span>{insight.text}</span>
          </div>
        )
      })}
    </div>
  )
}
