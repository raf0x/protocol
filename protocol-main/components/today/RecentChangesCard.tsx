import Link from 'next/link'
import type { TimelineEvent } from '../../lib/health/timeline'
import AppIcon from '../app/AppIcon'

export default function RecentChangesCard({ events }: { events: TimelineEvent[] }) {
  return <section className="today-card" aria-labelledby="changes-title"><div className="today-section-heading"><h2 id="changes-title"><AppIcon name="timeline" />Recent changes</h2><Link href="/timeline" className="app-icon-button" aria-label="View full timeline"><AppIcon name="chevron" size={16} /></Link></div>
    {events.length ? <ol className="today-changes">{events.map(event => <li key={event.id}><span className="today-event-dot" aria-hidden="true" /><div><h3>{event.title}</h3>{event.description && <p>{event.description}</p>}<time dateTime={event.date}>{new Date(event.date.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</time></div></li>)}</ol> : <p className="today-empty">Your protocol changes will appear here as your history grows.</p>}
  </section>
}
