import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import type { TimelineFilter } from '../../lib/health/timelinePresentation'
import styles from '../../app/timeline/timeline.module.css'

const content = {
  All: ['Your history starts here', 'Protocol changes and daily check-ins will build your health history.', '/protocol', 'Go to Today'],
  Protocols: ['No protocol changes yet', 'Your recorded protocol changes will appear here over time.', '/protocol/manage', 'View protocols'],
  Weight: ['Your first weight is a starting point', 'Log a weight in Health to begin tracking changes over time.', '/journal', 'Open Health'],
  Journal: ['Make room for a check-in', 'Record how you feel, your sleep, or a note in Health.', '/journal', 'Open Health'],
  Labs: ['No lab results yet', 'Add a lab panel in Health to see it alongside your recorded history.', '/health?action=add', 'Add lab results'],
} as const

export default function TimelineEmpty({ filter }: { filter: TimelineFilter }) {
  const [title, description, href, action] = content[filter]
  return <section className={styles.empty}><AppIcon name="timeline" size={28} /><h2>{title}</h2><p>{description}</p>{href && <Link href={href}>{action}</Link>}</section>
}
