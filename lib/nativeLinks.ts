import { isNativeAppRuntime } from './clientRuntime'

/** Where a link should be handled. See docs/capacitor-architecture-decision.md. */
export type LinkTarget =
  | 'in-app'
  | 'system-browser'
  | 'system-handler'
  | 'blocked'

const APP_HOSTS = ['www.mypepprotocol.app', 'mypepprotocol.app']
const SYSTEM_HANDLER_PROTOCOLS = ['mailto:', 'tel:']

/**
 * Classifies a link without performing navigation.
 *
 * Pure and side-effect free so it is testable and safe to evaluate during
 * render on both web and native. Relative and same-origin URLs stay in the
 * app, external HTTPS goes to the system browser, mailto/tel go to their
 * native handler, and anything else is refused rather than guessed at.
 */
export function classifyLink(
  href: string,
  currentOrigin?: string
): LinkTarget {
  const value = href.trim()

  if (!value) return 'blocked'

  // Fragment, query, relative, and root-relative links are always internal.
  if (
    value.startsWith('#') ||
    value.startsWith('?') ||
    value.startsWith('/')
  ) {
    // Protocol-relative (//host) is not root-relative; treat as absolute.
    if (!value.startsWith('//')) return 'in-app'
  }

  let url: URL

  try {
    const base =
      currentOrigin ||
      (typeof window !== 'undefined'
        ? window.location.origin
        : 'https://www.mypepprotocol.app')

    url = new URL(value, base)
  } catch {
    return 'blocked'
  }

  if (SYSTEM_HANDLER_PROTOCOLS.includes(url.protocol)) {
    return 'system-handler'
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return 'blocked'
  }

  if (APP_HOSTS.includes(url.hostname)) {
    return 'in-app'
  }

  return 'system-browser'
}

/**
 * True when a link must be handed to iOS instead of navigating the WebView.
 *
 * Always false on web, so wiring this into a component cannot change existing
 * browser or PWA behavior. The native branch is inert until the Capacitor
 * bridge is present.
 */
export function requiresNativeHandoff(
  href: string,
  currentOrigin?: string
): boolean {
  if (!isNativeAppRuntime()) return false

  const target = classifyLink(href, currentOrigin)

  return target === 'system-browser' || target === 'system-handler'
}