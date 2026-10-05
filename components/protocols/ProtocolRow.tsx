import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { PhaseRow } from '../../lib/health/timeline'
import { dosingDisplay } from '../../lib/health/dosingEntry'
import { scheduleLabel } from '../../lib/health/protocolPresentation'
import DoseSummary, { dosingIssue } from './DoseSummary'
import { StatusPill } from '../app/DesignSystem'
import AppIcon from '../app/AppIcon'
import styles from '../../app/protocol/today-v2.module.css'

export default function ProtocolRow({ id, name, week, phase, protocolId, color, selected, onSelect }: {
  id: string; name: string; week: number | null; phase: PhaseRow | null; protocolId: string
  color: string; selected: boolean; onSelect: (id: string) => void
}) {
  const medication = dosingDisplay(phase).medication
  let issue: { title: string } | null = null
  try { issue = phase?.dosing_entry ? dosingIssue(phase.dosing_entry) : null }
  catch { issue = { title: 'Dose details need review' } }
  return <li className={styles.protocolRow} style={{ '--ring-color': color } as CSSProperties} data-selected={selected}>
    <button type="button" className={styles.rowSelect} aria-pressed={selected} aria-label={`${name}. Select protocol`} onClick={() => onSelect(id)}>
      <span className={styles.identityMarker} aria-hidden="true" />
      <span className={styles.rowCopy}>
        <strong className={styles.rowName}>{name}</strong>
        <span className={styles.rowDose}>{medication ? <DoseSummary phase={phase} compact showIssue={false} /> : 'Medication amount unknown'}<span> · {scheduleLabel(phase)}</span></span>
        <StatusPill warning={Boolean(issue) || !phase}>{issue?.title || (!phase ? 'No current phase' : week === null ? 'Active' : `Active · Week ${week}`)}</StatusPill>
      </span>
    </button>
    <Link href={`/protocol/manage?protocol=${encodeURIComponent(protocolId)}`} className={styles.rowManage} aria-label={`Manage ${name}`}><AppIcon name="chevron" size={18} /></Link>
  </li>
}
