// Minimal service worker for PWA install criterion + offline-friendly shell.
// We cache built assets and let Socket.IO / API traffic pass to the network.
//
// IMPORTANT: index.html is served NETWORK-FIRST. A stale-while-revalidate HTML
// shell would hand back an old index.html after a deploy — and that old HTML
// points at hashed asset files (index-OLDHASH.js) that no longer exist on the
// server, so the page renders blank until a manual refresh. Network-first means
// every load gets the current HTML (with current asset hashes); the cached copy
// is only a fallback for going fully offline.

const CACHE = 'belot-shell-v4'
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

  // Treat page navigations (and any HTML request) as network-first so a fresh
  // deploy is always picked up. Fall back to the cached shell only when offline.
  const isHtml =
    req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')

  if (isHtml) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone()
            caches.open(CACHE).then((cache) => cache.put('/index.html', copy)).catch(() => {})
          }
          return res
        })
        .catch(async () => {
          const cache = await caches.open(CACHE)
          return (await cache.match('/index.html')) || (await cache.match('/')) || Response.error()
        }),
    )
    return
  }

  // Hashed assets + icons + manifest: cache-first, revalidate in the background.
  // These filenames are content-hashed, so a cached hit is always correct.
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
