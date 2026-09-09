import type { ReactNode } from 'react'
import type { ProtocolRow, ProtocolEventRow, JournalEntryRow } from '../../lib/health/timeline'
import type { WeightUnit } from '../../lib/weightUtils'
import { todayProtocols, recentChanges, type TodayDue } from '../../lib/health/today'
import TodayHeader from './TodayHeader'
import TodaysFocusCard from './TodaysFocusCard'
import ActiveProtocolList from './ActiveProtocolList'
import RecentChangesCard from './RecentChangesCard'
import HealthTrendsCard from './HealthTrendsCard'

type Props = {
  date: string; protocols: ProtocolRow[]; events: ProtocolEventRow[]; entries: JournalEntryRow[]
  due: TodayDue[]; logs: Record<string, { taken: boolean }>; saving: boolean
  onTaken: (id: string) => void; error: string | null; selected: string | null
  onSelect: (id: string) => void; rings: ReactNode; detail: ReactNode
  weightUnit: WeightUnit; onToggleUnit: () => void
}
export default function TodayOverview(props: Props) {
  return <div className="today-overview">
    <TodayHeader date={props.date} />
    <TodaysFocusCard activeCount={props.protocols.length} due={props.due} logs={props.logs} saving={props.saving} onTaken={props.onTaken} error={props.error} />
    <ActiveProtocolList items={todayProtocols(props.protocols, props.date)} selected={props.selected} onSelect={props.onSelect}>{props.rings}</ActiveProtocolList>
    {props.detail}
    <div className="today-insights-grid"><RecentChangesCard events={recentChanges(props.events, props.protocols)} /><HealthTrendsCard entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} /></div>
    <p className="today-note">A clearer picture, one day at a time.</p>
  </div>
}
