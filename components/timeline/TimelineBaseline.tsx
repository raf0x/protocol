import Link from 'next/link'
import { formatTimelineDate, type CurrentBaseline } from '../../lib/health/timeline'
import styles from '../../app/timeline/timeline.module.css'

export default function TimelineBaseline({ baseline }: { baseline: CurrentBaseline }) {
  return <section className={styles.baseline} aria-labelledby="baseline-title">
    <div className={styles.sectionHeading}><h2 id="baseline-title">Current Baseline</h2><span>Where you are now</span></div>
    <dl className={styles.baselineStats}>
      <div><dt>Latest weight</dt><dd>{baseline.weight != null ? <>{baseline.weight}<small> lbs</small></> : 'Not recorded'}</dd>{baseline.weightDate && <time dateTime={baseline.weightDate}>{formatTimelineDate(baseline.weightDate)}</time>}</div>
      <div><dt>Active protocols</dt><dd>{baseline.activeProtocolCount}</dd><span>Current saved plans</span></div>
    </dl>
    <div className={styles.lastChange}><span>Last protocol change</span>{baseline.lastProtocolChangeDate ? <><strong>{baseline.lastProtocolChangeTitle || 'Protocol updated'}</strong><time dateTime={baseline.lastProtocolChangeDate}>{formatTimelineDate(baseline.lastProtocolChangeDate)}</time></> : <p>No changes recorded yet</p>}</div>
    {baseline.activeProtocols.length > 0 && <details className={styles.disclosure}>
      <summary>Active protocols <span>{baseline.activeProtocolCount}</span></summary>
      <ul className={styles.baselineProtocols}>{baseline.activeProtocols.map(protocol => <li key={protocol.id}>
        <Link href={`/protocol/manage?protocol=${encodeURIComponent(protocol.id)}`}>{protocol.name || 'Protocol'}</Link>
        {protocol.compounds.map(compound => <div key={compound.id}>
          {compound.name && compound.name !== protocol.name && <strong>{compound.name}</strong>}
          {compound.details.length > 0 && <p>{compound.details.join(' · ')}</p>}
          {compound.issue && <p>Dose details need clarification. <Link href={`/protocol/manage?protocol=${encodeURIComponent(protocol.id)}`}>Review plan</Link></p>}
        </div>)}
        <p>{protocol.week != null && `Week ${protocol.week}`}{protocol.week != null && protocol.startDate && ' · '}{protocol.startDate && `Started ${formatTimelineDate(protocol.startDate)}`}</p>
      </li>)}</ul>
    </details>}
  </section>
}
