var CACHE_NAME = 'coaching-v1'
var ASSETS = ['/', '/index.html']

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME }).map(function(n) { return caches.delete(n) })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url)

  // Skip API calls and external resources - network only
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return
  }

  // For app assets: cache first, then network
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/) || url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        if (cached) return cached
        return fetch(e.request).then(function(response) {
          if (response.ok) {
            var clone = response.clone()
            caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone) })
          }
          return response
        })
      })
    )
    return
  }

  // For HTML navigation: network first, fallback to cache
  e.respondWith(
    fetch(e.request).then(function(response) {
      var clone = response.clone()
      caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone) })
      return response
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || caches.match('/')
      })
    })
  )
})
