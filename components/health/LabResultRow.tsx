import { labReference, labValue, type LabResultInput } from '../../lib/health/labs'
import LabStatusBadge from './LabStatusBadge'
import styles from '../../app/health/health.module.css'

export default function LabResultRow({ result }: { result: LabResultInput }) {
  return <div className={styles.result}>
    <div className={styles.rowHeading}><h3>{result.biomarker_name}</h3><LabStatusBadge status={result.status} /></div>
    <p className={styles.value}>{labValue(result)}</p>
    <p className={styles.secondary}>Reference: {labReference(result)}{result.unit && (result.reference_low != null || result.reference_high != null) && ` ${result.unit}`}</p>
    <span className={styles.caption}>{result.status_source === 'reported' ? 'As reported by the lab' : result.status_source === 'derived' ? 'Compared with entered numeric bounds' : 'No interpretation supplied'}</span>
  </div>
}
