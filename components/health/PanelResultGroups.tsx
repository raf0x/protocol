import { groupPanelResults } from '../../lib/health/biomarkerIntelligence'
import type { LabResult } from '../../lib/health/labs'
import LabResultRow from './LabResultRow'
import styles from '../../app/health/health.module.css'

export default function PanelResultGroups({ results }: { results: LabResult[] }) {
  if (!results.length) return <p>No results recorded in this panel.</p>
  return <div className={styles.resultGroups}>{groupPanelResults(results).map(group => <section key={group.category} className={styles.resultGroup} aria-labelledby={`group-${group.category.replace(/\W/g, '-').toLowerCase()}`}>
    <h3 id={`group-${group.category.replace(/\W/g, '-').toLowerCase()}`}>{group.category}<span>{group.results.length}</span></h3>
    {group.results.map(result => <div key={result.id}><LabResultRow result={result} />{result.source_raw && <details className={styles.formDetails}><summary>Original source · {result.import_confidence} parser confidence</summary><pre className={styles.raw}>{JSON.stringify(result.source_raw, null, 2)}</pre></details>}</div>)}
  </section>)}</div>
}
