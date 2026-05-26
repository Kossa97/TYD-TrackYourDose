// api/send-reminders.js — Vercel Serverless Function (Cron: every minute)
// Reads active cycles, finds due intake times, sends Web Push notifications.

const webPush   = require('web-push')
const { createClient } = require('@supabase/supabase-js')

// ── Slot-time defaults (matching Peptide.tsx INTAKE_TIME_CONFIG) ──────────────
const SLOT_TIMES = {
  morgens: '08:00',
  mittags: '12:00',
  abends:  '20:00',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert UTC Date to HH:MM in a given IANA timezone */
function getLocalHHMM(date, timezone) {
  try {
    return date
      .toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour12: false,
        hour:   '2-digit',
        minute: '2-digit',
      })
      .slice(0, 5)
  } catch {
    const h = String(date.getUTCHours()).padStart(2, '0')
    const m = String(date.getUTCMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
}

/** Returns true if slotTime matches the current local minute exactly */
function isNow(slotTime, localHHMM) {
  return slotTime === localHHMM
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // Secure the endpoint — Vercel injects CRON_SECRET automatically
  const authHeader = req.headers['authorization'] ?? ''
  const cronSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Validate required env vars
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' })
  }

  webPush.setVapidDetails(
    `mailto:${VAPID_EMAIL ?? 'admin@tyd.app'}`,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  )

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const now      = new Date()

  // 1. Load all push subscriptions
  const { data: subs, error: subsErr } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, subscription, timezone')

  if (subsErr) return res.status(500).json({ error: subsErr.message })
  if (!subs?.length) return res.status(200).json({ sent: 0, info: 'no subscriptions' })

  // Build user → local time map
  const userIds      = [...new Set(subs.map((s) => s.user_id))]
  const localTimeMap = {}
  for (const sub of subs) {
    if (!localTimeMap[sub.user_id]) {
      localTimeMap[sub.user_id] = getLocalHHMM(now, sub.timezone ?? 'UTC')
    }
  }

  // 2. Load active cycles for subscribed users, joined with peptide name
  const { data: cycles, error: cyclesErr } = await supabase
    .from('cycles')
    .select('id, user_id, name, dose, unit, intake_time, intake_time_custom, peptides(name)')
    .eq('active', true)
    .in('user_id', userIds)

  if (cyclesErr) return res.status(500).json({ error: cyclesErr.message })
  if (!cycles?.length) return res.status(200).json({ sent: 0, info: 'no active cycles' })

  // 3. Determine which cycles are due right now for each user
  // userId → array of notification payloads
  const dueMap = {}

  for (const cycle of cycles) {
    const localHHMM = localTimeMap[cycle.user_id]
    if (!localHHMM) continue

    const slots   = (cycle.intake_time ?? '').split(',').filter(Boolean)
    const customs = (cycle.intake_time_custom ?? '').split(',')

    for (let i = 0; i < slots.length; i++) {
      const slot     = slots[i]
      const slotTime = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
      if (!slotTime) continue

      if (isNow(slotTime, localHHMM)) {
        const peptideName = cycle.peptides?.name ?? cycle.name
        const payload = {
          title: `💊 ${peptideName}`,
          body:  `${cycle.dose} ${cycle.unit} · ${slotTime} Uhr – jetzt einnehmen`,
          url:   '/kalender',
          // Unique tag prevents duplicate notifications for same cycle + time
          tag:   `dose-${cycle.id}-${slotTime.replace(':', '')}`,
        }
        if (!dueMap[cycle.user_id]) dueMap[cycle.user_id] = []
        dueMap[cycle.user_id].push(payload)
      }
    }
  }

  const dueUserIds = Object.keys(dueMap)
  if (!dueUserIds.length) {
    return res.status(200).json({ sent: 0, info: 'nothing due right now' })
  }

  // 4. Send push notifications
  let sent   = 0
  let failed = 0
  const staleEndpoints = []

  for (const sub of subs) {
    const payloads = dueMap[sub.user_id]
    if (!payloads?.length) continue

    for (const payload of payloads) {
      try {
        await webPush.sendNotification(sub.subscription, JSON.stringify(payload))
        sent++
      } catch (err) {
        failed++
        // 410 Gone / 404 Not Found → subscription expired, clean up
        if (err.statusCode === 410 || err.statusCode === 404) {
          staleEndpoints.push(sub.endpoint)
        }
      }
    }
  }

  // 5. Remove stale subscriptions
  if (staleEndpoints.length) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints)
  }

  return res.status(200).json({ sent, failed, dueUsers: dueUserIds.length })
}
