const safePart = (value: string, fallback: string, max: number) => {
  const cleaned = value.replace(/[^a-zA-Z0-9_./:-]/g, '').slice(0, max)
  return cleaned || fallback
}

export function sanitizeOperationalRoute(route: string) {
  const path = route.split('?')[0].split('#')[0]
  const parts = path.split('/').filter(Boolean).map(part =>
    part.length > 32 || /^\d+$/.test(part) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(part) ? ':id' : safePart(part, ':segment', 32))
  return `/${parts.join('/')}`.slice(0, 160) || '/unknown'
}

export function sanitizeOperationalType(value: string) {
  return safePart(value, 'UnknownError', 80)
}

export function operationalErrorType(error: unknown) {
  return sanitizeOperationalType(error instanceof Error ? error.name : typeof error)
}
