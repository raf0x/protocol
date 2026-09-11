import Link from 'next/link'
import { panelSummary, type LabPanel } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import AppIcon from '../app/AppIcon'
import styles from '../../app/health/health.module.css'

export default function LabPanelCard({ panel }: { panel: LabPanel }) {
  return <Link className={styles.panelCard} href={`/health?panel=${encodeURIComponent(panel.id)}`}>
    <div className={styles.rowHeading}><span className={styles.eyebrow}><AppIcon name="health" size={18} />Lab panel</span><AppIcon name="chevron" size={18} /></div>
    <h3>{panel.panel_name || 'Lab results'}</h3><time dateTime={panel.test_date}>{formatTimelineDate(panel.test_date)}</time>
    {panel.provider && <p className={styles.secondary}>{panel.provider}</p>}<p className={styles.summary}>{panelSummary(panel.results)}</p>
  </Link>
}
