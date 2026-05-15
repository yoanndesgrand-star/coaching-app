var CACHE_NAME = 'coaching-v' + Date.now()

// Push notifications
self.addEventListener('push', function(e) {
  var data = e.data ? e.data.json() : { title: 'YD Coaching', body: 'Notification' }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      vibrate: [200, 100, 200],
      tag: data.tag || 'default',
      data: data.url || '/'
    })
  )
})

self.addEventListener('notificationclick', function(e) {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data || '/'))
})

// Install: skip waiting immediately
self.addEventListener('install', function(e) {
  self.skipWaiting()
})

// Activate: delete ALL old caches, claim clients
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME }).map(function(n) { return caches.delete(n) })
      )
    }).then(function() {
      return self.clients.claim()
    })
  )
})

// Fetch: network first, cache fallback (offline support)
self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url)

  // Skip API calls and external resources
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return
  }

  e.respondWith(
    fetch(e.request).then(function(response) {
      if (response.ok) {
        var clone = response.clone()
        caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone) })
      }
      return response
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('/')
      })
    })
  )
})
