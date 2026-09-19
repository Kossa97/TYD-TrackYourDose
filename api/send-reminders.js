// api/send-reminders.js — Vercel Cron (stündlich, siehe vercel.json).
// Fälligkeit = Feuerzeitpunkt liegt im Fenster (now - REMINDER_WINDOW_MIN, now].

import { createRequire } from 'node:module'
import { dueReminders, localParts } from './_lib/reminderSchedule.js'

const require = createRequire(import.meta.url)

function sbHeaders(key) {
  return { 'Authorization': `Bearer ${key}`, 'apikey': key, 'Content-Type': 'application/json' }
}

async function sbGet(url, key) {
  const response = await fetch(url, { headers: sbHeaders(key) })
  const text = await response.text()
  if (!response.ok) throw new Error(`Supabase ${response.status}: ${text}`)
  return JSON.parse(text)
}

export function mapTimelineRow(row) {
  return {
    cycle: {
      id: row.id,
      stack_item_id: row.stack_item_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      ...(row.start_local_date ? { start_local_date: row.start_local_date } : {}),
      ...(row.end_local_date ? { end_local_date: row.end_local_date } : {}),
    },
    versions: row.versions ?? [],
    pauses: row.pauses ?? [],
  }
}

export function buildCyclesUrl(base, userIds) {
  const userFilter = userIds.map(id => `"${id}"`).join(',')
  const select = [
    'id', 'user_id', 'stack_item_id', 'name', 'reminder', 'started_at', 'ended_at', 'start_local_date', 'end_local_date', 'closed_by_migration_resolution',
    'stack_items(display_name,archived,configuration_status,migration_conflicts:cycle_migration_conflicts(resolved_at))',
    'versions:cycle_plan_versions(id,created_at,cycle_id,effective_kind,effective_at,effective_local_date,change_kind,frequency,x_days_interval,interval_unit,cycle_on_days,cycle_off_days,schedule_days,intake_time,intake_time_custom,slot_doses,slot_days,dose,unit,method)',
    'pauses:cycle_pause_periods(id,cycle_id,paused_at,ends_at)',
  ].join(',')
  return `${base}/rest/v1/cycles?user_id=in.(${userFilter})&select=${select}`
}

function formattedQuantity(dose, unit) {
  if (!Number.isFinite(dose) || dose <= 0 || typeof unit !== 'string' || !unit.trim()) return null
  return `${dose} ${unit.trim()}`
}

export function payloadFor(cycle, due) {
  const name = cycle.stack_items?.display_name ?? cycle.name
  const quantity = formattedQuantity(due.dose, due.unit)
  const timing = due.offset === '1day'
    ? `morgen um ${due.time} Uhr`
    : due.offset === '2h'
      ? `in 2 Stunden (${due.time} Uhr)`
      : `${due.time} Uhr – jetzt einnehmen`
  return {
    title: `💊 ${name}`,
    body: quantity ? `${quantity} · ${timing}` : timing,
    url: '/kalender',
    tag: `dose-${due.routineSlotKey}-${due.offset}`,
  }
}

export async function sendRemindersForSubscriptions({
  subscriptions,
  cycles,
  now,
  windowMin,
  sendNotification,
  logError = console.error,
}) {
  const cyclesByUser = new Map()
  for (const cycle of cycles) {
    const item = cycle.stack_items
    if (cycle.closed_by_migration_resolution || item?.archived || item?.configuration_status === 'needs_review'
      || item?.migration_conflicts?.some(conflict => conflict.resolved_at === null)) continue
    const userCycles = cyclesByUser.get(cycle.user_id) ?? []
    userCycles.push(cycle)
    cyclesByUser.set(cycle.user_id, userCycles)
  }

  let sent = 0
  let failed = 0
  const stale = []
  const dueUsers = new Set()

  for (const subscription of subscriptions) {
    let payloads
    try {
      localParts(now, subscription.timezone)
      payloads = (cyclesByUser.get(subscription.user_id) ?? []).flatMap(cycle => (
        dueReminders(
          mapTimelineRow(cycle),
          cycle.reminder,
          now,
          subscription.timezone,
          windowMin,
        ).map(due => payloadFor(cycle, due))
      ))
    } catch {
      failed += 1
      logError('Reminder subscription skipped: invalid timezone')
      continue
    }

    if (!payloads.length) continue
    dueUsers.add(subscription.user_id)
    for (const payload of payloads) {
      try {
        await sendNotification(subscription.subscription, JSON.stringify(payload))
        sent += 1
      } catch (error) {
        failed += 1
        if (error?.statusCode === 410 || error?.statusCode === 404) stale.push(subscription.endpoint)
      }
    }
  }

  return { sent, failed, dueUsers: dueUsers.size, stale }
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
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    )

    const base = SUPABASE_URL
    const key = SUPABASE_SERVICE_KEY
    const now = new Date()
    const windowMin = Number(process.env.REMINDER_WINDOW_MIN ?? 60)
    const subscriptions = await sbGet(
      `${base}/rest/v1/push_subscriptions?select=user_id,endpoint,subscription,timezone`,
      key,
    )
    if (!subscriptions?.length) {
      return res.status(200).end(JSON.stringify({ sent: 0, info: 'no subscriptions' }))
    }

    const userIds = [...new Set(subscriptions.map(subscription => subscription.user_id))]
    const cycles = await sbGet(buildCyclesUrl(base, userIds), key)
    if (!cycles?.length) return res.status(200).end(JSON.stringify({ sent: 0, info: 'no open cycles' }))

    const result = await sendRemindersForSubscriptions({
      subscriptions,
      cycles,
      now,
      windowMin,
      sendNotification: (subscription, payload) => webPush.sendNotification(subscription, payload),
      logError: console.error,
    })

    if (result.stale.length) {
      await fetch(
        `${base}/rest/v1/push_subscriptions?endpoint=in.(${result.stale.map(endpoint => `"${endpoint}"`).join(',')})`,
        { method: 'DELETE', headers: sbHeaders(key) },
      ).catch(() => {})
    }

    const { stale: _stale, ...response } = result
    if (result.sent === 0 && result.failed === 0) response.info = 'nothing due'
    return res.status(200).end(JSON.stringify(response))
  } catch (error) {
    return res.status(500).end(JSON.stringify({
      error: 'Server crash',
      hint: String(error?.message ?? error),
    }))
  }
}
