'use client'
import { convertWeight, formatWeight, getWeightLabel, type WeightUnit } from '../../lib/weightUtils'

type Props = {
  currentWeight: number | null
  totalLost: number
  weightStartDate: string | null
  dueCompounds: { id: string; name: string }[]
  weightUnit: WeightUnit
  onToggleUnit: () => void
}

export default function StatsBoxes({ currentWeight, totalLost, weightStartDate, dueCompounds, weightUnit, onToggleUnit }: Props) {
  const formatDate = (d: string | null) => {
    if (!d) return ''
    const dt = new Date(d + 'T00:00:00')
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  // Convert weights from lbs (stored) to display unit
  const displayWeight = currentWeight ? convertWeight(currentWeight, 'lbs', weightUnit) : null
  const displayLost = convertWeight(Math.abs(totalLost), 'lbs', weightUnit)
  const unit = getWeightLabel(weightUnit)

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', width: '100%' }}>
      <div onClick={onToggleUnit} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px 12px', textAlign: 'center', flex: '1', cursor: 'pointer' }}>
        <div style={{ fontSize: '24px', fontWeight: '800', color: '#f59e0b', lineHeight: '1' }}>
          {displayWeight ? formatWeight(displayWeight, weightUnit) : '—'}
        </div>
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#f59e0b', marginTop: '2px' }}>{unit}</div>
        <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--color-dim)', marginTop: '6px', letterSpacing: '0.5px' }}>
          CURRENT WEIGHT
        </div>
      </div>

      <div onClick={onToggleUnit} style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px 12px', textAlign: 'center', flex: '1', cursor: 'pointer' }}>
        <div style={{ fontSize: '24px', fontWeight: '800', color: totalLost > 0 ? '#22c55e' : totalLost < 0 ? '#ef4444' : 'var(--color-dim)', lineHeight: '1' }}>
          {totalLost > 0 ? '-' : totalLost < 0 ? '+' : ''}{formatWeight(displayLost, weightUnit)}
        </div>
        <div style={{ fontSize: '14px', fontWeight: '700', color: totalLost > 0 ? '#22c55e' : totalLost < 0 ? '#ef4444' : 'var(--color-dim)', marginTop: '2px' }}>
          {unit}
        </div>
        <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--color-dim)', marginTop: '6px', letterSpacing: '0.5px' }}>
          WEIGHT CHANGE
        </div>
        {weightStartDate && (
          <div style={{ fontSize: '9px', color: totalLost > 0 ? '#22c55e' : totalLost < 0 ? '#ef4444' : 'var(--color-text)', fontWeight: '600', marginTop: '4px' }}>
            since {formatDate(weightStartDate)}
          </div>
        )}
      </div>

      <div style={{ background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '16px 12px', textAlign: 'center', flex: '1' }}>
        <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--color-green)', lineHeight: '1' }}>
          {dueCompounds.length}
        </div>
        <div style={{ fontSize: '9px', fontWeight: '600', color: 'var(--color-dim)', marginTop: '8px', letterSpacing: '0.5px' }}>
          DUE TODAY
        </div>
        {dueCompounds.length > 0 ? (
          <div style={{ fontSize: '10px', color: 'var(--color-text)', marginTop: '8px', lineHeight: '1.3', fontWeight: '600' }}>
            {dueCompounds.map(c => c.name.split('/')[0].split(' ')[0]).join(', ')}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: 'var(--color-green)', marginTop: '8px', fontWeight: '700' }}>
            ✓ ALL LOGGED
          </div>
        )}
      </div>
    </div>
  )
}
