import type { LabPanel } from '../labs'
import type { LibraryProtocol } from '../protocolPresentation'
import type { OverlayProtocolEvent } from '../protocolOverlay'
import type { JournalEntryRow } from '../timeline'

export type LongitudinalSource = {
  protocols: LibraryProtocol[]; protocolEvents: OverlayProtocolEvent[]
  panels: LabPanel[]; journal: JournalEntryRow[]
}
export type SourceRef = { table: 'protocols' | 'phases' | 'protocol_events' | 'lab_results' | 'journal_entries'; id: string; parentId?: string; label: string }
export type MedicationDose = { value: number; unit: 'mg' | 'mcg' | 'IU' }
export type ProtocolState = {
  protocolId: string; compoundId: string; name: string; phaseId: string | null
  medication: MedicationDose | null; administration: string | null
  frequency: string | null; route: string | null
  provenance: 'snapshot' | 'saved_plan' | 'unknown'; sources: SourceRef[]; limitations: string[]
}
export type InterventionKind = 'started' | 'stopped' | 'paused' | 'resumed' | 'compound_added' | 'compound_removed'
  | 'dose_increased' | 'dose_decreased' | 'dose_changed' | 'frequency_changed' | 'route_changed' | 'phase_started' | 'phase_ended' | 'phase_continued'
export type Intervention = {
  id: string; date: string; protocolId: string; compoundId: string | null; phaseId: string | null
  kind: InterventionKind; title: string; before: MedicationDose | null; after: MedicationDose | null
  provenance: 'event' | 'saved_plan'; sources: SourceRef[]; limitations: string[]
}
export type Measurement = {
  id: string; key: string; name: string; type: 'lab' | 'weight' | 'journal'; date: string
  value: number; unit: string; percentageAllowed: boolean; source: SourceRef
  original: { name: string; value: number; unit: string; sourceType: string }
  reference?: { low: number | null; high: number | null; text: string | null }
}
export type ObservationWindow = { baselineDays: number; followupStartDays: number; followupEndDays: number }
export type EvidenceStrength = { level: 'repeated' | 'limited' | 'insufficient'; reasons: string[] }
export type LongitudinalObservation = {
  id: string; intervention: Intervention; metric: { key: string; name: string; unit: string }
  window: ObservationWindow; baseline: Measurement | null; followups: Measurement[]
  changes: { measurementId: string; delta: number; percent: number | null; direction: 'increased' | 'decreased' | 'unchanged'; daysAfter: number; daysBetween: number }[]
  confounders: Intervention[]; strength: EvidenceStrength; limitations: string[]
}
export type HealthVersion = {
  id: string; start: string; endExclusive: string | null; interventionIds: string[]
  protocols: ProtocolState[]; measurementIds: string[]
}
export type LongitudinalResult = {
  asOf: string; window: ObservationWindow; interventions: Intervention[]
  observations: LongitudinalObservation[]; versions: HealthVersion[]; limitations: string[]
}
type AnalystMeasurement = Pick<Measurement, 'date' | 'value' | 'unit' | 'reference'> & { source: SourceRef['table'] }
export type LongitudinalAnalystEvidence = {
  intervention: Pick<Intervention, 'date' | 'title' | 'before' | 'after' | 'provenance'> & { type: InterventionKind }
  baseline: AnalystMeasurement
  followups: (AnalystMeasurement & Omit<LongitudinalObservation['changes'][number], 'measurementId'>)[]
  window: ObservationWindow; followupDates: number; strength: EvidenceStrength
  confounders: Pick<Intervention, 'date' | 'title'>[]; confounderCount: number
  stateBefore: Pick<ProtocolState, 'name' | 'medication' | 'frequency' | 'route' | 'provenance' | 'limitations'>[]
  stateAtFollowup: LongitudinalAnalystEvidence['stateBefore']; limitations: string[]
}
