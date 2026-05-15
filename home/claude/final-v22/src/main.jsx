import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { LangProvider } from './lib/i18n'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <LangProvider>
      <App />
    </LangProvider>
  </BrowserRouter>
)

// Register service worker with auto-update
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      // Check for updates every 60 seconds
      setInterval(function() { reg.update() }, 60000)
      
      // When a new SW is found, reload when it activates
      reg.addEventListener('updatefound', function() {
        var newSW = reg.installing
        if (newSW) {
          newSW.addEventListener('statechange', function() {
            if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
              // New version available — reload silently
              window.location.reload()
            }
          })
        }
      })
    }).catch(function() {})
  })
  
  // Also reload when the controlling SW changes
  var refreshing = false
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (!refreshing) { refreshing = true; window.location.reload() }
  })
}

// Request notification permission + subscribe to push
if ('Notification' in window && 'serviceWorker' in navigator) {
  setTimeout(async function() {
    if (Notification.permission === 'default') {
      await Notification.requestPermission()
    }
    if (Notification.permission === 'granted') {
      try {
        // Get VAPID key
        var resp = await fetch('/api/admin-actions?action=vapid-key')
        var { publicKey } = await resp.json()
        if (!publicKey) return

        var reg = await navigator.serviceWorker.ready
        var sub = await reg.pushManager.getSubscription()

        if (!sub) {
          // Convert VAPID key
          var padding = '='.repeat((4 - publicKey.length % 4) % 4)
          var base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/')
          var raw = atob(base64)
          var arr = new Uint8Array(raw.length)
          for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)

          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: arr
          })
        }

        // Save subscription — get user ID from Supabase
        var { createClient } = await import('./lib/supabase')
        // Use a simple approach: store sub in localStorage, send when user is known
        localStorage.setItem('yd_push_sub', JSON.stringify(sub.toJSON()))
      } catch (e) {
        console.log('Push setup error:', e)
      }
    }
  }, 3000)
}

// Keep screen awake (prevent app from closing during workout)
if ('wakeLock' in navigator) {
  var wakeLock = null
  async function requestWakeLock() { try { wakeLock = await navigator.wakeLock.request('screen') } catch(e) {} }
  requestWakeLock()
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') requestWakeLock() })
}
