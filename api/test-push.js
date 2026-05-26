// api/test-push.js
// POST /api/test-push   Authorization: Bearer <supabase-access-token>
// Body (optional): { "endpoint": "<current-device-endpoint>" }

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function normalizeSubscription(row) {
  const sub = row?.subscription ?? row
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return null
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    expirationTime: sub.expirationTime ?? null,
  }
}

function readJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  }
  return {}
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  try {
    const webPush = require('web-push')

    if (req.method !== 'POST') {
      return res.status(405).end(JSON.stringify({ error: 'Method not allowed' }))
    }

    const token = (req.headers['authorization'] ?? '').replace('Bearer ', '')
    if (!token) return res.status(401).end(JSON.stringify({ error: 'No token' }))

    const {
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL,
      SUPABASE_URL, SUPABASE_SERVICE_KEY,
    } = process.env

    const missing = [
      !VAPID_PUBLIC_KEY     && 'VAPID_PUBLIC_KEY',
      !VAPID_PRIVATE_KEY    && 'VAPID_PRIVATE_KEY',
      !SUPABASE_URL         && 'SUPABASE_URL',
      !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
    ].filter(Boolean)

    if (missing.length) {
      return res.status(500).end(JSON.stringify({
        error: 'Missing env vars',
        hint:  `Fehlend in Vercel: ${missing.join(', ')}`,
      }))
    }

    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_KEY },
    })
    if (!userRes.ok) return res.status(401).end(JSON.stringify({ error: 'Invalid token' }))
    const user = await userRes.json()
    if (!user?.id) return res.status(401).end(JSON.stringify({ error: 'User not found' }))

    let targetEndpoint = null
    try {
      const body = readJsonBody(req)
      targetEndpoint = typeof body?.endpoint === 'string' ? body.endpoint : null
    } catch { /* leerer Body ok */ }

    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}&select=subscription,endpoint`,
      { headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } },
    )
    const subsBody = await subsRes.text()
    if (!subsRes.ok) {
      return res.status(500).end(JSON.stringify({
        error: 'DB error',
        hint:  subsBody.includes('does not exist')
          ? 'Tabelle push_subscriptions fehlt – SQL in Supabase ausführen'
          : subsBody,
      }))
    }

    let subs = JSON.parse(subsBody)
    if (!Array.isArray(subs) || subs.length === 0) {
      return res.status(404).end(JSON.stringify({
        error: 'no_subscription',
        hint:  'Keine Subscription in DB – Notifications in der App aktivieren',
      }))
    }

    if (targetEndpoint) {
      subs = subs.filter((s) => s.endpoint === targetEndpoint)
      if (!subs.length) {
        return res.status(404).end(JSON.stringify({
          error: 'stale_subscription',
          hint:  'Dieses Gerät ist nicht in der DB – bitte „Neu verbinden“ tippen',
        }))
      }
    }

    webPush.setVapidDetails(
      `mailto:${VAPID_EMAIL ?? 'admin@tyd.app'}`,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    )

    const payload = JSON.stringify({
      title: '✅ TYD – Test erfolgreich',
      body:  'Push-Notifications funktionieren!',
      url:   '/kalender',
      tag:   'tyd-test',
    })

    const pushOptions = { TTL: 60 * 60 * 24, urgency: 'high' }

    let sent = 0, failed = 0, lastErr = ''
    const stale = []
    const tried = []

    for (const row of subs) {
      const subscription = normalizeSubscription(row)
      if (!subscription) {
        failed++
        lastErr = 'Ungültiges Subscription-Format in DB'
        continue
      }
      tried.push(subscription.endpoint.includes('apple.com') ? 'apple' : 'other')
      try {
        await webPush.sendNotification(subscription, payload, pushOptions)
        sent++
      } catch (err) {
        failed++
        lastErr = `${err.statusCode ?? '?'}: ${err.message}`
        if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) stale.push(row.endpoint)
      }
    }

    if (stale.length) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${stale.map((e) => `"${e}"`).join(',')})`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`, apikey: SUPABASE_SERVICE_KEY } },
      ).catch(() => {})
    }

    if (sent === 0) {
      const isVapidReject = /403|401/.test(String(lastErr))
      return res.status(500).end(JSON.stringify({
        error: isVapidReject ? 'vapid_mismatch' : 'send_failed',
        hint:  isVapidReject
          ? 'Apple hat den Push abgelehnt (VAPID). Im Profil „Neu“ tippen. In Vercel: VITE_VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY setzen.'
          : `Versand fehlgeschlagen: ${lastErr}`,
      }))
    }

    return res.status(200).end(JSON.stringify({ success: true, sent, failed, tried }))
  } catch (err) {
    return res.status(500).end(JSON.stringify({
      error: 'Server crash',
      hint:  String(err?.message ?? err),
    }))
  }
}
