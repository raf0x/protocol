export function reportClientError(error: unknown, route?: string) {
  try {
    const errorType = error instanceof Error ? error.name : 'ClientError'
    void fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: route || window.location.pathname, errorType, status: 500 }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Monitoring cannot affect the user-facing recovery path.
  }
}
