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
  onViewDetails: () => void; detailsOpen: boolean; stats: ReactNode; rings: ReactNode; detail: ReactNode
  weightUnit: WeightUnit; onToggleUnit: () => void; schedule?: ReactNode
}
export default function TodayOverview(props: Props) {
  return <div className="today-overview">
    <TodayHeader date={props.date} />
    {props.stats}
    <ActiveProtocolList items={todayProtocols(props.protocols, props.date)} selected={props.selected} onViewDetails={props.onViewDetails} detailsOpen={props.detailsOpen}>{props.rings}</ActiveProtocolList>
    {props.detail}
    <TodaysFocusCard activeCount={props.protocols.length} due={props.due} logs={props.logs} saving={props.saving} onTaken={props.onTaken} error={props.error} />
    {props.schedule}
    <div className="today-insights-grid"><RecentChangesCard events={recentChanges(props.events, props.protocols)} /><HealthTrendsCard entries={props.entries} unit={props.weightUnit} onToggleUnit={props.onToggleUnit} /></div>
    <p className="today-note">A clearer picture, one day at a time.</p>
  </div>
}
