export function safeAuthReturnPath(value: string | null | undefined, fallback = '/protocol') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  try {
    const url = new URL(value, 'https://mypepprotocol.local')
    if (url.origin !== 'https://mypepprotocol.local' || url.pathname.startsWith('/auth/')) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
