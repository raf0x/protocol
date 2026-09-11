import Link from 'next/link'
import AppIcon from '../app/AppIcon'

export default function TodayHeader({ date }: { date: string }) {
  return <header className="today-header">
    <div className="today-brand-row">
      <Link href="/protocol" className="today-brand" aria-label="MyPepProtocol Today">MyPep<span>Protocol</span></Link>
      <Link href="/profile" className="app-icon-button" aria-label="Your profile"><AppIcon name="profile" /></Link>
    </div>
    <div className="today-welcome"><div><h1>Your day, in focus.</h1><time dateTime={date}>{new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</time></div><span className="today-live-dot" aria-hidden="true" /></div>
  </header>
}
