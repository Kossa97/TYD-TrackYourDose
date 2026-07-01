// api/send-reminders.js — Vercel Cron (stündlich, siehe vercel.json).
// Fälligkeit = Feuerzeitpunkt liegt im Fenster (now - REMINDER_WINDOW_MIN, now];
// das Fenster (Default 60) MUSS der Cron-Kadenz entsprechen — bei abweichender
// Kadenz (z. B. Vercel Hobby: nur täglich) REMINDER_WINDOW_MIN anpassen oder
// den Endpoint extern (Cron-Dienst + CRON_SECRET) im gewünschten Takt aufrufen.

import { createRequire } from 'node:module'
import {
  dueReminders,
  effectiveDoseForDay,
  localParts,
} from './_lib/reminderSchedule.js'

const require = createRequire(import.meta.url)

function sbHeaders(key) {
  return { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' }
}

async function sbGet(url, key) {
  const r = await fetch(url, { headers: sbHeaders(key) })
  const text = await r.text()
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${text}`)
  return JSON.parse(text)
}

function fmtDose(dose, unit) {
  const n = Math.round(dose * 100) / 100
  return `${n} ${unit}`
}

function payloadFor(cycle, due, dose) {
  const name = cycle.peptides?.name ?? cycle.name
  const body =
    due.offset === '1day' ? `${fmtDose(dose, cycle.unit)} · morgen um ${due.slotTime} Uhr` :
    due.offset === '2h'   ? `${fmtDose(dose, cycle.unit)} · in 2 Stunden (${due.slotTime} Uhr)` :
                            `${fmtDose(dose, cycle.unit)} · ${due.slotTime} Uhr – jetzt einnehmen`
  return {
    title: `💊 ${name}`,
    body,
    url: '/kalender',
    // Datum + Slot + Offset im Tag → pro Erinnerung genau eine Notification
    tag: `dose-${cycle.id}-${due.slotDateKey}-${due.slotTime.replace(':', '')}-${due.offset}`,
  }
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
    const windowMin = Number(process.env.REMINDER_WINDOW_MIN ?? 60)

    const subs = await sbGet(`${base}/rest/v1/push_subscriptions?select=user_id,endpoint,subscription,timezone`, key)
    if (!subs?.length) return res.status(200).end(JSON.stringify({ sent: 0, info: 'no subscriptions' }))

    const userIds = [...new Set(subs.map(s => s.user_id))]
    const nowLocalMap = {}
    for (const sub of subs) {
      if (!nowLocalMap[sub.user_id]) nowLocalMap[sub.user_id] = localParts(now, sub.timezone ?? 'UTC')
    }

    const userFilter = userIds.map(id => `"${id}"`).join(',')
    const cycles = await sbGet(
      `${base}/rest/v1/cycles?active=eq.true&user_id=in.(${userFilter})` +
      `&select=id,user_id,name,dose,unit,frequency,x_days_interval,schedule_days,` +
      `start_date,end_date,intake_time,intake_time_custom,reminder,schedule_history,peptides(name)`,
      key,
    )
    if (!cycles?.length) return res.status(200).end(JSON.stringify({ sent: 0, info: 'no active cycles' }))

    const cycleFilter = cycles.map(c => `"${c.id}"`).join(',')
    const escalations = await sbGet(
      `${base}/rest/v1/dose_escalations?cycle_id=in.(${cycleFilter})` +
      `&select=cycle_id,increase_amount,start_type,start_date,start_after_days`,
      key,
    ).catch(() => [])

    const dueMap = {}
    for (const cycle of cycles) {
      const nowLocal = nowLocalMap[cycle.user_id]
      if (!nowLocal) continue
      for (const due of dueReminders(cycle, nowLocal, windowMin)) {
        const dose = effectiveDoseForDay(cycle, due.slotDateKey, escalations)
        if (!dueMap[cycle.user_id]) dueMap[cycle.user_id] = []
        dueMap[cycle.user_id].push(payloadFor(cycle, due, dose))
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
