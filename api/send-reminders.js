// api/send-reminders.js — Vercel Cron: every hour (0 * * * *)

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const SLOT_TIMES = { morgens: '08:00', mittags: '12:00', abends: '20:00' }

function getLocalHHMM(date, timezone) {
  try {
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone, hour12: false, hour: '2-digit', minute: '2-digit',
    }).slice(0, 5)
  } catch {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`
  }
}

function isNow(slotTime, localHHMM) {
  return slotTime.split(':')[0] === localHHMM.split(':')[0]
}

function sbHeaders(key) {
  return { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' }
}

async function sbGet(url, key) {
  const r = await fetch(url, { headers: sbHeaders(key) })
  const text = await r.text()
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`)
  return JSON.parse(text)
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')

  try {
    const webPush = require('web-push')

    const cronSecret = (req.headers['authorization'] ?? '').replace('Bearer ', '')
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return res.status(401).end(JSON.stringify({ error: 'Unauthorized' }))
    }

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env
    const missing = [
      !VAPID_PUBLIC_KEY && 'VAPID_PUBLIC_KEY', !VAPID_PRIVATE_KEY && 'VAPID_PRIVATE_KEY',
      !SUPABASE_URL && 'SUPABASE_URL', !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
    ].filter(Boolean)
    if (missing.length) return res.status(500).end(JSON.stringify({ error: `Missing: ${missing.join(', ')}` }))

    webPush.setVapidDetails(
      `mailto:${VAPID_EMAIL ?? 'admin@tyd.app'}`,
      VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
    )

    const base = SUPABASE_URL, key = SUPABASE_SERVICE_KEY, now = new Date()

    const subs = await sbGet(`${base}/rest/v1/push_subscriptions?select=user_id,endpoint,subscription,timezone`, key)
    if (!subs?.length) return res.status(200).end(JSON.stringify({ sent: 0, info: 'no subscriptions' }))

    const userIds = [...new Set(subs.map(s => s.user_id))]
    const localTimeMap = {}
    for (const sub of subs) {
      if (!localTimeMap[sub.user_id]) localTimeMap[sub.user_id] = getLocalHHMM(now, sub.timezone ?? 'UTC')
    }

    const userFilter = userIds.map(id => `"${id}"`).join(',')
    const cycles = await sbGet(
      `${base}/rest/v1/cycles?active=eq.true&user_id=in.(${userFilter})` +
      `&select=id,user_id,name,dose,unit,intake_time,intake_time_custom,peptides(name)`,
      key,
    )
    if (!cycles?.length) return res.status(200).end(JSON.stringify({ sent: 0, info: 'no active cycles' }))

    const dueMap = {}
    for (const cycle of cycles) {
      const localHHMM = localTimeMap[cycle.user_id]
      if (!localHHMM) continue
      const slots = (cycle.intake_time ?? '').split(',').filter(Boolean)
      const customs = (cycle.intake_time_custom ?? '').split(',')
      for (let i = 0; i < slots.length; i++) {
        const slotTime = slots[i] === 'custom' ? (customs[i] ?? '') : (SLOT_TIMES[slots[i]] ?? '')
        if (!slotTime || !isNow(slotTime, localHHMM)) continue
        if (!dueMap[cycle.user_id]) dueMap[cycle.user_id] = []
        dueMap[cycle.user_id].push({
          title: `💊 ${cycle.peptides?.name ?? cycle.name}`,
          body:  `${cycle.dose} ${cycle.unit} · ${slotTime} Uhr – jetzt einnehmen`,
          url: '/kalender', tag: `dose-${cycle.id}-${slotTime.replace(':', '')}`,
        })
      }
    }

    if (!Object.keys(dueMap).length) return res.status(200).end(JSON.stringify({ sent: 0, info: 'nothing due' }))

    let sent = 0, failed = 0
    const stale = []

    for (const sub of subs) {
      const payloads = dueMap[sub.user_id]
      if (!payloads?.length) continue
      for (const p of payloads) {
        try { await webPush.sendNotification(sub.subscription, JSON.stringify(p)); sent++ }
        catch (err) { failed++; if (err.statusCode === 410 || err.statusCode === 404) stale.push(sub.endpoint) }
      }
    }

    if (stale.length) {
      await fetch(
        `${base}/rest/v1/push_subscriptions?endpoint=in.(${stale.map(e => `"${e}"`).join(',')})`,
        { method: 'DELETE', headers: sbHeaders(key) },
      ).catch(() => {})
    }

    return res.status(200).end(JSON.stringify({ sent, failed, dueUsers: Object.keys(dueMap).length }))

  } catch (err) {
    return res.status(500).end(JSON.stringify({
      error: 'Server crash',
      hint:  String(err && err.message ? err.message : err),
    }))
  }
}
