// api/test-push.js — Sends a test push to the authenticated user
// POST /api/test-push  Authorization: Bearer <supabase-access-token>

const webPush          = require('web-push')
const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers['authorization']?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  const missing = [
    !VAPID_PUBLIC_KEY    && 'VAPID_PUBLIC_KEY',
    !VAPID_PRIVATE_KEY   && 'VAPID_PRIVATE_KEY',
    !SUPABASE_URL        && 'SUPABASE_URL',
    !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
  ].filter(Boolean)
  if (missing.length) {
    return res.status(500).json({
      error: 'Missing environment variables',
      hint:  `Fehlend in Vercel: ${missing.join(', ')}`,
    })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Verify Supabase JWT → get user
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  // Load all push subscriptions for this user
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('subscription, endpoint')
    .eq('user_id', user.id)

  if (subsErr) return res.status(500).json({ error: subsErr.message })
  if (!subs?.length) return res.status(404).json({ error: 'no_subscription', hint: 'Notifications wurden noch nicht aktiviert' })

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

  for (const sub of subs) {
    try {
      await webPush.sendNotification(sub.subscription, payload)
      sent++
    } catch (err) {
      failed++
      if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.endpoint)
      console.error('[test-push] sendNotification error:', err.statusCode, err.message)
    }
  }

  // Clean up expired subscriptions
  if (stale.length) {
    await supabase.from('push_subscriptions').delete().in('endpoint', stale)
  }

  if (sent === 0) {
    return res.status(500).json({
      error:  'send_failed',
      hint:   'Subscription vorhanden, aber Versand fehlgeschlagen. Prüfe VAPID-Keys.',
      failed,
      staleRemoved: stale.length,
    })
  }

  return res.status(200).json({ success: true, sent, failed })
}
