import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import type { TimelineEvent } from '../../lib/health/timeline'
import styles from '../../app/timeline/timeline.module.css'

export default function LabTimelineEvent({ event }: { event: TimelineEvent }) {
  return <article className={styles.card} data-category="Labs">
    <span className={styles.category}><AppIcon name="health" size={17} />Labs</span><h4>{event.title}</h4>
    {typeof event.metadata?.provider === 'string' && event.metadata.provider !== event.title && <p className={styles.association}>{event.metadata.provider}</p>}
    <p className={styles.description}>{event.description}</p>
    <Link className={styles.protocolLink} href={`/health?panel=${encodeURIComponent(event.sourceId)}`}>View panel<AppIcon name="chevron" size={14} /></Link>
  </article>
}
