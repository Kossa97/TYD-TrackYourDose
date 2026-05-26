// api/test-push.js — Sends a test push to the authenticated user
// POST /api/test-push   Authorization: Bearer <supabase-access-token>
// Uses only fetch() + web-push — no @supabase/supabase-js (avoids ESM/CJS issues)

const webPush = require('web-push')

module.exports = async function handler(req, res) {
  // Always return JSON, never crash silently
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const token = req.headers['authorization']?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'No token' })

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env

    // Report exactly which vars are missing
    const missing = [
      !VAPID_PUBLIC_KEY     && 'VAPID_PUBLIC_KEY',
      !VAPID_PRIVATE_KEY    && 'VAPID_PRIVATE_KEY',
      !SUPABASE_URL         && 'SUPABASE_URL',
      !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
    ].filter(Boolean)

    if (missing.length) {
      return res.status(500).json({
        error: 'Missing environment variables',
        hint:  `Fehlend in Vercel: ${missing.join(', ')}`,
      })
    }

    // ── 1. Verify Supabase JWT via REST API ────────────────────────────────
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_SERVICE_KEY,
      },
    })

    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid token', hint: 'Supabase auth fehlgeschlagen' })
    }

    const user = await userRes.json()
    if (!user?.id) {
      return res.status(401).json({ error: 'User not found' })
    }

    // ── 2. Load push subscriptions via REST API ────────────────────────────
    const subsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}&select=subscription,endpoint`,
      {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
      },
    )

    if (!subsRes.ok) {
      const err = await subsRes.text()
      return res.status(500).json({
        error: 'DB query failed',
        hint: err.includes('does not exist')
          ? 'Tabelle push_subscriptions fehlt – SQL-Migration ausführen'
          : err,
      })
    }

    const subs = await subsRes.json()

    if (!Array.isArray(subs) || subs.length === 0) {
      return res.status(404).json({
        error:  'no_subscription',
        hint:   'Keine Subscription gefunden – Notifications in der App aktivieren',
      })
    }

    // ── 3. Send test notification ──────────────────────────────────────────
    webPush.setVapidDetails(
      `mailto:${VAPID_EMAIL ?? 'admin@tyd.app'}`,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    )

    const payload = JSON.stringify({
      title: '✅ TYD – Test erfolgreich',
      body:  'Push-Notifications funktionieren korrekt!',
      url:   '/kalender',
      tag:   'tyd-test',
    })

    let sent   = 0
    let failed = 0
    const stale = []
    let lastErr = null

    for (const sub of subs) {
      try {
        await webPush.sendNotification(sub.subscription, payload)
        sent++
      } catch (err) {
        failed++
        lastErr = `${err.statusCode}: ${err.message}`
        if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.endpoint)
      }
    }

    // Remove expired subscriptions
    if (stale.length) {
      const inList = stale.map(e => encodeURIComponent(e)).join(',')
      await fetch(
        `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=in.(${stale.map(e => `"${e}"`).join(',')})`,
        {
          method:  'DELETE',
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
        },
      ).catch(() => { /* ignore cleanup errors */ })
      void inList
    }

    if (sent === 0) {
      return res.status(500).json({
        error:  'send_failed',
        hint:   `Subscription vorhanden, aber Versand fehlgeschlagen. Prüfe VAPID-Keys. Detail: ${lastErr}`,
        failed,
      })
    }

    return res.status(200).json({ success: true, sent, failed })

  } catch (err) {
    // Catch-all: always return JSON, never HTML
    return res.status(500).json({
      error: 'Unexpected server error',
      hint:  String(err?.message ?? err),
    })
  }
}
