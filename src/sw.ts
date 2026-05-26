/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

// ── Precaching (manifest injected by vite-plugin-pwa) ────────────────────────
clientsClaim()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST ?? [])
cleanupOutdatedCaches()

// ── Skip waiting on explicit message ─────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload: {
    title?: string
    body?: string
    tag?: string
    url?: string
  } = {}

  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { body: event.data?.text() ?? '' }
  }

  const title   = payload.title ?? 'TYD – Track Your Dose'
  const options: NotificationOptions = {
    body:             payload.body ?? '',
    icon:             '/icon-192.png',
    badge:            '/icon-192.png',
    tag:              payload.tag ?? 'tyd-reminder',
    data:             { url: payload.url ?? '/kalender' },
    requireInteraction: false,
    silent:           false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click → open / focus app ────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = (event.notification.data?.url as string | undefined) ?? '/kalender'

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if URL matches
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return (client as WindowClient).focus()
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
        return undefined
      })
  )
})
