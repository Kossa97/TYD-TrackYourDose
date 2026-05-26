// api/test-push.js
// POST /api/test-push   Authorization: Bearer <supabase-access-token>

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

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

    // ── Verify JWT ─────────────────────────────────────────────────────────
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { 'Authorization': `Bearer ${token}`, 'apikey': SUPABASE_SERVICE_KEY },
    })
    if (!userRes.ok) {
      return res.status(401).end(JSON.stringify({ error: 'Invalid token' }))
    }
    const user = await userRes.json()
    if (!user?.id) return res.status(401).end(JSON.stringify({ error: 'User not found' }))

    // ── Load subscriptions ─────────────────────────────────────────────────
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}&select=subscription,endpoint`,
      { headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY } },
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
    const subs = JSON.parse(subsBody)
    if (!Array.isArray(subs) || subs.length === 0) {
      return res.status(404).end(JSON.stringify({
        error: 'no_subscription',
        hint:  'Keine Subscription in DB – Notifications in der App aktivieren',
      }))
    }

    // ── Send test push ─────────────────────────────────────────────────────
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

    let sent = 0, failed = 0, lastErr = ''
    const stale = []

    for (const sub of subs) {
      try {
        await webPush.sendNotification(sub.subscription, payload)
        sent++
      } catch (err) {
        failed++
        lastErr = `${err.statusCode ?? '?'}: ${err.message}`
        if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.endpoint)
      }
    }

    if (stale.length) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${stale.map(e => `"${e}"`).join(',')})`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`, 'apikey': SUPABASE_SERVICE_KEY } },
      ).catch(() => {})
    }

    if (sent === 0) {
      return res.status(500).end(JSON.stringify({
        error: 'send_failed',
        hint:  `Subscription vorhanden, Versand fehlgeschlagen: ${lastErr}`,
      }))
    }

    return res.status(200).end(JSON.stringify({ success: true, sent, failed }))

  } catch (err) {
    return res.status(500).end(JSON.stringify({
      error: 'Server crash',
      hint:  String(err && err.message ? err.message : err),
    }))
  }
}
