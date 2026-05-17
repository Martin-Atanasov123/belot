// Minimal service worker for PWA install criterion + offline-friendly shell.
// We cache the app shell (index.html + built assets) and let Socket.IO / API
// traffic pass straight through to the network.

const CACHE = 'belot-shell-v1'
const SHELL = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)
  // Never touch sockets / cross-origin / api calls.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/socket.io')) return
  if (url.pathname.startsWith('/rooms') || url.pathname === '/health') return

  // Stale-while-revalidate for the app shell + built assets.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req)
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone())
          return res
        })
        .catch(() => cached || Response.error())
      return cached || network
    }),
  )
})
