// api/send-reminders.js — Vercel Cron: every hour (0 * * * *)
// Reads active cycles, finds due intake times, sends Web Push.
// Uses only fetch() + web-push — no @supabase/supabase-js (avoids ESM/CJS issues)

const webPush = require('web-push')

const SLOT_TIMES = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

function getLocalHHMM(date, timezone) {
  try {
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit',
    }).slice(0, 5)
  } catch {
    const h = String(date.getUTCHours()).padStart(2, '0')
    const m = String(date.getUTCMinutes()).padStart(2, '0')
    return `${h}:${m}`
  }
}

// Hourly cron: match on hour component only
function isNow(slotTime, localHHMM) {
  return slotTime.split(':')[0] === localHHMM.split(':')[0]
}

// ── Supabase REST helpers ─────────────────────────────────────────────────────

function sbHeaders(serviceKey) {
  return {
    'Authorization': `Bearer ${serviceKey}`,
    'apikey': serviceKey,
    'Content-Type': 'application/json',
  }
}

async function sbGet(url, serviceKey) {
  const r = await fetch(url, { headers: sbHeaders(serviceKey) })
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`)
  return r.json()
}

async function sbDelete(url, serviceKey) {
  await fetch(url, { method: 'DELETE', headers: sbHeaders(serviceKey) }).catch(() => {})
}

// ── Main handler ──────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  try {
    // Verify cron secret
    const authHeader = req.headers['authorization'] ?? ''
    const cronSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
    const missing = [
      !VAPID_PUBLIC_KEY     && 'VAPID_PUBLIC_KEY',
      !VAPID_PRIVATE_KEY    && 'VAPID_PRIVATE_KEY',
      !SUPABASE_URL         && 'SUPABASE_URL',
      !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
    ].filter(Boolean)
    if (missing.length) return res.status(500).json({ error: `Missing: ${missing.join(', ')}` })

    webPush.setVapidDetails(
      `mailto:${VAPID_EMAIL ?? 'admin@tyd.app'}`,
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    )

    const base = SUPABASE_URL
    const key  = SUPABASE_SERVICE_KEY
    const now  = new Date()

    // ── 1. Load all push subscriptions ──────────────────────────────────────
    const subs = await sbGet(
      `${base}/rest/v1/push_subscriptions?select=user_id,endpoint,subscription,timezone`,
      key,
    )
    if (!subs?.length) return res.status(200).json({ sent: 0, info: 'no subscriptions' })

    const userIds     = [...new Set(subs.map(s => s.user_id))]
    const localTimeMap = {}
    for (const sub of subs) {
      if (!localTimeMap[sub.user_id]) {
        localTimeMap[sub.user_id] = getLocalHHMM(now, sub.timezone ?? 'UTC')
      }
    }

    // ── 2. Load active cycles with peptide names ─────────────────────────────
    const userFilter = userIds.map(id => `"${id}"`).join(',')
    const cycles = await sbGet(
      `${base}/rest/v1/cycles?active=eq.true&user_id=in.(${userFilter})` +
      `&select=id,user_id,name,dose,unit,intake_time,intake_time_custom,peptides(name)`,
      key,
    )
    if (!cycles?.length) return res.status(200).json({ sent: 0, info: 'no active cycles' })

    // ── 3. Find due notifications ────────────────────────────────────────────
    const dueMap = {}
    for (const cycle of cycles) {
      const localHHMM = localTimeMap[cycle.user_id]
      if (!localHHMM) continue
      const slots   = (cycle.intake_time ?? '').split(',').filter(Boolean)
      const customs = (cycle.intake_time_custom ?? '').split(',')
      for (let i = 0; i < slots.length; i++) {
        const slot     = slots[i]
        const slotTime = slot === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slot] ?? '')
        if (!slotTime || !isNow(slotTime, localHHMM)) continue
        const peptideName = cycle.peptides?.name ?? cycle.name
        if (!dueMap[cycle.user_id]) dueMap[cycle.user_id] = []
        dueMap[cycle.user_id].push({
          title: `💊 ${peptideName}`,
          body:  `${cycle.dose} ${cycle.unit} · ${slotTime} Uhr – jetzt einnehmen`,
          url:   '/kalender',
          tag:   `dose-${cycle.id}-${slotTime.replace(':', '')}`,
        })
      }
    }

    if (!Object.keys(dueMap).length) {
      return res.status(200).json({ sent: 0, info: 'nothing due right now' })
    }

    // ── 4. Send notifications ────────────────────────────────────────────────
    let sent  = 0, failed = 0
    const stale = []

    for (const sub of subs) {
      const payloads = dueMap[sub.user_id]
      if (!payloads?.length) continue
      for (const p of payloads) {
        try {
          await webPush.sendNotification(sub.subscription, JSON.stringify(p))
          sent++
        } catch (err) {
          failed++
          if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.endpoint)
        }
      }
    }

    // ── 5. Remove stale subscriptions ───────────────────────────────────────
    if (stale.length) {
      await sbDelete(
        `${base}/rest/v1/push_subscriptions?endpoint=in.(${stale.map(e => `"${e}"`).join(',')})`,
        key,
      )
    }

    return res.status(200).json({ sent, failed, dueUsers: Object.keys(dueMap).length })

  } catch (err) {
    return res.status(500).json({ error: 'Unexpected error', hint: String(err?.message ?? err) })
  }
}
