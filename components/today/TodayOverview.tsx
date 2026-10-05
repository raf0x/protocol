import type { ReactNode } from 'react'
import type { ProtocolRow, ProtocolEventRow, JournalEntryRow } from '../../lib/health/timeline'
import type { WeightUnit } from '../../lib/weightUtils'
import { type TodayDue } from '../../lib/health/today'
import styles from '../../app/protocol/today-v2.module.css'
import TodayHeader from './TodayHeader'
import TodayStatusStrip from './TodayStatusStrip'
import TodaysFocusCard from './TodaysFocusCard'
import ActiveProtocolList from './ActiveProtocolList'
import HealthTrendsCard from './HealthTrendsCard'

type Props = {
  date: string; protocols: ProtocolRow[]; events: ProtocolEventRow[]; entries: JournalEntryRow[]
  due: TodayDue[]; logs: Record<string, { taken: boolean }>; saving: boolean
  onTaken: (id: string) => void; error: string | null; selected: string | null
  onSelect: (id: string) => void; rings: ReactNode; detail: ReactNode
  weightUnit: WeightUnit; onToggleUnit: () => void; schedule?: ReactNode; checkin?: ReactNode
  onExportCSV?: () => void; warning?: ReactNode
}
export default function TodayOverview(props: Props) {
  return <div className={styles.overview}>
    <TodayHeader date={props.date} weight={<TodayStatusStrip entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} />} />
    <div className={styles.dailySummary}>
      <HealthTrendsCard entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} />
      <TodaysFocusCard key={props.date} activeCount={props.protocols.length} due={props.due} logs={props.logs} saving={props.saving} onTaken={props.onTaken} error={props.error} protocols={props.protocols} date={props.date} />
    </div>
    {props.warning}
    <ActiveProtocolList protocols={props.protocols} date={props.date} selected={props.selected} onSelect={props.onSelect} onExportCSV={props.onExportCSV} detail={props.detail}>{props.rings}</ActiveProtocolList>
    {props.checkin}
    {props.protocols.length > 0 && props.schedule}
  </div>
}
