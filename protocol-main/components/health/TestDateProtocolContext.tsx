import { contextAtDate, type OverlayProtocolEvent } from '../../lib/health/protocolOverlay'
import type { LabObservation } from '../../lib/health/labs'
import type { LibraryProtocol } from '../../lib/health/protocolPresentation'
import { formatTimelineDate } from '../../lib/health/timeline'
import LabStatusBadge from './LabStatusBadge'
import styles from '../../app/health/health.module.css'

export default function TestDateProtocolContext({ observation, protocols, events }: { observation: LabObservation; protocols: LibraryProtocol[]; events: OverlayProtocolEvent[] }) {
  const contexts = protocols.flatMap(protocol => contextAtDate(protocol, observation.date, events))
  const value = observation.result.value != null ? `${observation.result.value}${observation.result.unit ? ` ${observation.result.unit}` : ''}` : `${observation.result.value_text ?? 'Not recorded'}${observation.result.unit ? ` ${observation.result.unit}` : ''}`
  return <article className={styles.testContext}>
    <header><div><time dateTime={observation.date}>{formatTimelineDate(observation.date)}</time><strong>{value}</strong></div><LabStatusBadge status={observation.result.status} /></header>
    <h3>At this test date</h3>
    {contexts.length ? <ul>{contexts.map(context => <li key={`${context.protocolId}:${context.compoundId}`}>
      <strong>{context.compoundName}</strong><span>{context.dose}{context.frequency ? ` · ${context.frequency}` : ''}{context.route ? ` · ${context.route}` : ''}</span>
      <small>{context.week ? `Week ${context.week}` : context.protocolName}{context.issue ? ` · ${context.issue}` : ''}</small>
    </li>)}</ul> : <p>No selected protocol was recorded as active on this date.</p>}
  </article>
}
