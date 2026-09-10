import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import { formatTimelineDate, protocolMetadataChips, type groupTimeline, type TimelineEvent } from '../../lib/health/timeline'
import { eventTime, journalPresentation } from '../../lib/health/timelinePresentation'
import styles from '../../app/timeline/timeline.module.css'
import LabTimelineEvent from './LabTimelineEvent'

function Notes({ text }: { text: string }) {
  return text.length > 180 ? <details className={styles.notes}><summary><span>{text.slice(0, 160).trimEnd()}…</span><strong>Read full note</strong></summary><p>{text}</p></details> : <p className={styles.description}>{text}</p>
}

export function TimelineEventCard({ event, comparison }: { event: TimelineEvent; comparison?: { delta: number; date: string } }) {
  if (event.category === 'Labs') return <LabTimelineEvent event={event} />
  const chips = protocolMetadataChips(event)
  const time = eventTime(event.date)
  const journal = event.category === 'Journal' ? journalPresentation(event) : null
  const protocolId = event.metadata?.protocolId
  const association = event.metadata?.compoundName
  return <article className={styles.card} data-category={event.category}>
    <div className={styles.eventHeading}><span className={styles.category}><AppIcon name={event.category === 'Protocol' ? 'protocols' : event.category === 'Weight' ? 'health' : 'timeline'} size={17} />{event.category === 'Weight' ? 'Weight logged' : event.category === 'Journal' ? 'Journal' : 'Protocol change'}</span>{time && <time dateTime={event.date}>{time}</time>}</div>
    <h4 className={event.category === 'Weight' ? styles.weight : undefined}>{event.title}</h4>
    {event.category === 'Protocol' && typeof association === 'string' && !event.title.includes(association) && <p className={styles.association}>{association}</p>}
    {event.category === 'Weight' && comparison && <p className={styles.delta}>{comparison.delta === 0 ? 'No change' : `${comparison.delta > 0 ? '+' : '−'}${Math.abs(comparison.delta)} ${event.metadata?.unit || ''}`} <span>since {formatTimelineDate(comparison.date)}</span></p>}
    {journal ? <>{journal.metrics.length > 0 && <ul className={styles.chips} aria-label="Journal metrics">{journal.metrics.map(metric => <li key={metric}>{metric}</li>)}</ul>}{journal.notes && <Notes text={journal.notes} />}</> : event.description && <Notes text={event.description} />}
    {chips.length > 0 && <div className={styles.plan}><span>Saved plan context</span><ul className={styles.chips}>{chips.map(chip => <li key={chip}>{chip}</li>)}</ul></div>}
    {event.category === 'Protocol' && typeof protocolId === 'string' && protocolId && <Link className={styles.protocolLink} href={`/protocol/manage?protocol=${encodeURIComponent(protocolId)}`}>View protocol<AppIcon name="chevron" size={14} /></Link>}
  </article>
}

export default function TimelineHistory({ months, comparisons }: { months: ReturnType<typeof groupTimeline>; comparisons: Map<string, { delta: number; date: string }> }) {
  return <div className={styles.history}>{months.map(month => <section key={month.key} aria-labelledby={`month-${month.key}`}>
    <h2 className={styles.month} id={`month-${month.key}`}>{month.label}</h2>
    {month.days.map(day => <section className={styles.day} key={day.date} aria-label={formatTimelineDate(day.date)}>
      <h3 className={styles.date}><time dateTime={day.date}>{formatTimelineDate(day.date)}</time></h3>
      <ol className={styles.list}>{day.events.map(event => <li key={event.id}><TimelineEventCard event={event} comparison={comparisons.get(event.id)} /></li>)}</ol>
    </section>)}
  </section>)}</div>
}
