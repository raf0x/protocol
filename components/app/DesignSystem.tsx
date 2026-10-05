import type { ComponentPropsWithRef, ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react'
import styles from './design-system-v2.module.css'

export function SectionHeader({ id, title, action }: { id: string; title: ReactNode; action?: ReactNode }) {
  return <div className={styles.sectionHeader}><h2 id={id}>{title}</h2>{action}</div>
}

export function SectionCard({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`${styles.card} ${className}`} {...props} />
}

export function StatusPill({ children, warning = false }: { children: ReactNode; warning?: boolean }) {
  return <span className={`${styles.status} ${warning ? styles.warning : ''}`}>{children}</span>
}

export function PrimaryAction({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${styles.primaryAction} ${className}`} {...props} />
}

export function SecondaryAction({ className = '', ...props }: ComponentPropsWithRef<'button'>) {
  return <button type="button" className={`${styles.secondaryAction} ${className}`} {...props} />
}

// Native details keeps children mounted: collapsing tools must not reset their effects or state.
export function CompactDisclosure({ title, description, children, className = '' }: {
  title: string; description?: string; children: ReactNode; className?: string
}) {
  return <details className={`${styles.disclosure} ${className}`}>
    <summary><span>{title}{description && <small>{description}</small>}</span><span className={styles.disclosureChevron} aria-hidden="true">⌄</span></summary>
    <div className={styles.disclosureContent}>{children}</div>
  </details>
}

export function SummaryGrid({ children }: { children: ReactNode }) {
  return <dl className={styles.summaryGrid}>{children}</dl>
}
