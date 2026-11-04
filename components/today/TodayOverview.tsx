import type { ReactNode } from 'react'
import type { ProtocolRow, JournalEntryRow } from '../../lib/health/timeline'
import type { WeightUnit } from '../../lib/weightUtils'
import { type TodayDue } from '../../lib/health/today'
import styles from '../../app/protocol/today-v2.module.css'
import TodayHeader from './TodayHeader'
import TodayStatusStrip from './TodayStatusStrip'
import TodaysFocusCard from './TodaysFocusCard'
import ActiveProtocolList from './ActiveProtocolList'
import HealthTrendsCard from './HealthTrendsCard'

type Props = {
  date: string; protocols: ProtocolRow[]; entries: JournalEntryRow[]
  healthStatus?: 'loading' | 'ready' | 'error'; onRetryHealth?: () => void
  healthAvailable?: boolean
  due: TodayDue[]; logs: Record<string, { taken: boolean }>; saving: boolean
  onTaken: (id: string) => void; error: string | null; selected: string | null
  onSelect: (id: string) => void; rings: ReactNode; detail: ReactNode
  weightUnit: WeightUnit; onToggleUnit: () => void; schedule?: ReactNode; checkin?: ReactNode
  onExportCSV?: () => void; warning?: ReactNode
}
export default function TodayOverview(props: Props) {
  const healthReady = (props.healthStatus ?? 'ready') === 'ready'
  const healthAvailable = props.healthAvailable ?? healthReady
  const healthNotice = <section className="today-card" role={props.healthStatus === 'error' ? 'alert' : 'status'}>{props.healthStatus === 'error' ? <>Health and check-in couldn’t be loaded. <button className="today-text-link" onClick={props.onRetryHealth}>Retry health</button></> : 'Loading health and check-in…'}</section>
  return <div className={styles.overview}>
    <TodayHeader date={props.date} weight={healthReady ? <TodayStatusStrip entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} /> : healthAvailable ? <fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><TodayStatusStrip entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} /></fieldset> : undefined} />
    <div className={styles.dailySummary}>
      {healthReady ? <HealthTrendsCard entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} /> : healthAvailable ? <div>{healthNotice}<fieldset disabled style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><HealthTrendsCard entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} /></fieldset></div> : healthNotice}
      <TodaysFocusCard key={props.date} activeCount={props.protocols.length} due={props.due} logs={props.logs} saving={props.saving} onTaken={props.onTaken} error={props.error} protocols={props.protocols} date={props.date} />
    </div>
    {props.warning}
    <ActiveProtocolList protocols={props.protocols} date={props.date} selected={props.selected} onSelect={props.onSelect} onExportCSV={props.onExportCSV} detail={props.detail}>{props.rings}</ActiveProtocolList>
    {healthAvailable && props.checkin}
    {props.protocols.length > 0 && props.schedule}
  </div>
}
