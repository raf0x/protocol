import Link from 'next/link'
import type { ReactNode } from 'react'
import AppIcon from '../app/AppIcon'
import styles from '../../app/protocol/today-v2.module.css'

export default function TodayHeader({ date, weight }: { date: string; weight?: ReactNode }) {
  return <header className={styles.header}>
    <div className={styles.brandRow}>
      <Link href="/protocol" className={styles.brand} aria-label="MyPepProtocol Today">MyPep<span>Protocol</span></Link>
      <Link href="/profile" className="app-icon-button" aria-label="Your profile"><AppIcon name="profile" /></Link>
    </div>
    <div className={styles.welcomeRow}>
      <div className={styles.welcome}>
        <h1>Hello, here’s your day.</h1>
        <time dateTime={date}>{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</time>
        <p>Consistent actions compound.</p>
      </div>
      {weight}
    </div>
  </header>
}
