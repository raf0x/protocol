const CACHE_NAME = 'mypepprotocol-shell-v1'
const SAFE_SHELL_ASSETS = ['/offline', '/manifest.json', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SAFE_SHELL_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name)))),
      self.clients.claim(),
    ])
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || request.mode !== 'navigate') return

  // Authenticated pages and health data are always network-only. The cached
  // response is a static offline explanation, never a stale application page.
  event.respondWith(fetch(request).catch(() => caches.match('/offline')))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'MyPepProtocol'
  const options = {
    body: data.body || 'You have a new notification.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/protocol' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/protocol'
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})
