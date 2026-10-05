import Link from 'next/link'
import type { ReactNode } from 'react'
import AppIcon from '../app/AppIcon'
import { SectionCard, SecondaryAction } from '../app/DesignSystem'
import EmptyProtocolRings from '../protocols/EmptyProtocolRings'
import { activeRingItems } from '../../lib/protocols/rings'
import type { ProtocolRow as Protocol } from '../../lib/health/timeline'
import styles from '../../app/protocol/today-v2.module.css'

type Props = { protocols: Protocol[]; date: string; selected: string | null; onSelect: (id: string) => void; detail: ReactNode; children: ReactNode; onExportCSV?: () => void }
export default function ActiveProtocolList({ protocols, date, detail, children, onExportCSV }: Props) {
  const items = activeRingItems(protocols, date)
  return <SectionCard aria-labelledby="active-title" className={styles.activeProtocols}>
    <div className={styles.heroHeader}>
      <h2 id="active-title">Active protocols</h2>
      <Link className={`today-text-link ${styles.heroManage}`} href="/protocol/manage">Manage <AppIcon name="chevron" size={14} /></Link>
      <div className={styles.heroActions}>
        {protocols.length > 0 && onExportCSV && <SecondaryAction className={styles.heroExport} onClick={onExportCSV}>↓ Export CSV</SecondaryAction>}
      </div>
    </div>
    {items.length ? <>
      <div className={styles.rings}>{children}</div>
      <div className={styles.selectedSnapshot}>{detail}</div>
    </> : <EmptyProtocolRings />}
  </SectionCard>
}
