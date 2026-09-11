import Link from 'next/link'

export default function OfflinePage() {
  return <main className="app-offline-page">
    <div>
      <span aria-hidden="true">↻</span>
      <h1>You are offline</h1>
      <p>Reconnect to view current health data or save changes. MyPepProtocol does not show cached health records as current.</p>
      <Link href="/protocol">Try again</Link>
    </div>
  </main>
}
