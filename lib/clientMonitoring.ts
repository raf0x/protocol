/** errorType/status are optional overrides for callers that already have a
 * sanitized classification (e.g. a fixed slug, not free text) rather than an
 * Error object -- existing callers passing just (error) or (error, route)
 * are unaffected, since both still default exactly as before. */
export function reportClientError(error: unknown, route?: string, errorType?: string, status = 500) {
  try {
    const type = errorType || (error instanceof Error ? error.name : 'ClientError')
    const path = route || (typeof window !== 'undefined' ? window.location.pathname : 'unknown')
    void fetch('/api/monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: path, errorType: type, status }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    // Monitoring cannot affect the user-facing recovery path.
  }
}
