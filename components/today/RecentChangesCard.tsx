import Link from 'next/link'
import type { TimelineEvent } from '../../lib/health/timeline'
import AppIcon from '../app/AppIcon'
import { SectionCard, SectionHeader } from '../app/DesignSystem'
import styles from '../../app/protocol/today-v2.module.css'

export default function RecentChangesCard({ events }: { events: TimelineEvent[] }) {
  return <SectionCard aria-labelledby="changes-title"><SectionHeader id="changes-title" title="Recent changes" action={<Link href="/timeline" className="app-icon-button" aria-label="View full timeline"><AppIcon name="chevron" size={16} /></Link>} />
    {events.length ? <ol className={styles.changes}>{events.slice(0, 3).map(event => <li key={event.id}><div><h3>{event.title}</h3>{event.description && <p>{event.description}</p>}</div><time dateTime={event.date}>{new Date(event.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time></li>)}</ol> : <p className="today-empty">Your protocol changes will appear here.</p>}
  </SectionCard>
}
