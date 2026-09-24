const authOrigin = 'https://mypepprotocol.local'

function validatedPath(value: string | null | undefined): string | null {
  if (!value || /\s/.test(value) || /%(?![\da-f]{2})/i.test(value)) return null
  try {
    // Check decoded forms as well: proxies/frameworks may decode before routing.
    let decoded = value
    for (let depth = 0; depth < 6; depth++) {
      if (!decoded.startsWith('/') || decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded.split(/[?#]/, 1)[0]) || /[\\\u0000-\u001f\u007f]/.test(decoded)) return null
      const url = new URL(decoded, authOrigin)
      if (url.origin !== authOrigin || url.pathname.startsWith('//') || /^\/auth(?:\/|$)/i.test(url.pathname)) return null
      if (!/%[\da-f]{2}/i.test(decoded)) {
        const original = new URL(value, authOrigin)
        return `${original.pathname}${original.search}${original.hash}`
      }
      decoded = decodeURIComponent(decoded)
    }
    return null
  } catch {
    return null
  }
}

export function safeAuthReturnPath(value: string | null | undefined, fallback = '/protocol') {
  return validatedPath(value) ?? validatedPath(fallback) ?? '/protocol'
}
