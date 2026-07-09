const CACHE_VERSION = 'dicomvision-web-shell-v1'
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/app-icon.png',
  '/icons/app-icon-192.png'
]

function isSameOrigin(url) {
  return url.origin === self.location.origin
}

function isApiOrPatientDataRequest(url) {
  const pathname = url.pathname.toLowerCase()
  return (
    pathname.startsWith('/api') ||
    pathname.startsWith('/socket.io') ||
    pathname.startsWith('/ws') ||
    pathname.includes('/dicom') ||
    pathname.includes('/render')
  )
}

function isStaticShellAsset(url) {
  return (
    url.pathname === '/' ||
    url.pathname === '/index.html' ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/app-icon.png' ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/assets/')
  )
}

function isDevelopmentModuleRequest(request, url) {
  return (
    request.destination === 'script' ||
    request.destination === 'worker' ||
    request.destination === 'sharedworker' ||
    request.destination === 'style' ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.vue')
  )
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(CACHE_VERSION)
      await cache.put('/index.html', response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match('/index.html')
    if (cached) return cached
    const fallback = await caches.match('/')
    if (fallback) return fallback
    return new Response('DicomVision is unavailable offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_VERSION)
  const cached = await cache.match(request)
  const fetchPromise = fetch(request).then((response) => {
    if (response && response.ok && response.type === 'basic') {
      void cache.put(request, response.clone())
    }
    return response
  })
  return cached || fetchPromise
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (!isSameOrigin(url) || isApiOrPatientDataRequest(url)) return
  if (isDevelopmentModuleRequest(request, url)) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }

  if (isStaticShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(request))
  }
})
