import { describe, expect, it, vi } from 'vitest'
import { dueReminders, localParts, reminderKeys } from './reminderSchedule.js'
import {
  buildCyclesUrl,
  mapTimelineRow,
  payloadFor,
  sendRemindersForSubscriptions,
} from '../send-reminders.js'

function version(overrides = {}) {
  return {
    id: 'v1', cycle_id: 'c1', effective_kind: 'local_date', effective_at: null,
    effective_local_date: '2026-01-01', change_kind: 'initial', frequency: 'Täglich',
    x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null,
    schedule_days: [], intake_time: 'morgens', intake_time_custom: null,
    slot_doses: null, slot_days: null, dose: 10, unit: 'mg', method: 'oral',
    ...overrides,
  }
}

function timeline(overrides = {}) {
  return {
    cycle: {
      id: 'c1', stack_item_id: 's1', started_at: '2026-01-01T00:00:00.000Z', ended_at: null,
    },
    versions: [version()],
    pauses: [],
    ...overrides,
  }
}

function cycleRow(overrides = {}) {
  return {
    id: 'c1', user_id: 'u1', stack_item_id: 's1', name: 'Cycle name', reminder: 'on_time',
    started_at: '2026-01-01T00:00:00.000Z', ended_at: null,
    versions: [version()], pauses: [], stack_items: { display_name: 'Exact peptide' },
    ...overrides,
  }
}

describe('localParts', () => {
  it('returns the stored-zone local date and minute', () => {
    expect(localParts(new Date('2026-06-29T18:30:00.000Z'), 'Europe/Berlin'))
      .toEqual({ dateKey: '2026-06-29', minutes: 1230 })
    expect(localParts(new Date('2026-06-29T18:30:00.000Z'), 'America/New_York'))
      .toEqual({ dateKey: '2026-06-29', minutes: 870 })
  })

  it('throws instead of silently substituting UTC for an invalid or missing zone', () => {
    expect(() => localParts(new Date('2026-06-29T08:15:00.000Z'), 'Not/AZone'))
      .toThrow('Invalid IANA time zone: Not/AZone')
    expect(() => localParts(new Date('2026-06-29T08:15:00.000Z'), ''))
      .toThrow('Missing IANA time zone')
  })
})

describe('reminder evaluation from normalized occurrences', () => {
  it('keeps the exact exclusive/inclusive instant window boundaries', () => {
    const value = timeline()
    expect(dueReminders(value, 'on_time', new Date('2026-06-29T06:00:00.000Z'), 'Europe/Berlin', 60)).toHaveLength(1)
    expect(dueReminders(value, 'on_time', new Date('2026-06-29T06:59:00.000Z'), 'Europe/Berlin', 60)).toHaveLength(1)
    expect(dueReminders(value, 'on_time', new Date('2026-06-29T07:00:00.000Z'), 'Europe/Berlin', 60)).toEqual([])
    expect(dueReminders(value, 'on_time', new Date('2026-06-29T05:59:00.000Z'), 'Europe/Berlin', 60)).toEqual([])
  })

  it('uses absolute occurrence instants for a 2h offset across midnight', () => {
    const value = timeline({ versions: [version({ intake_time: 'custom', intake_time_custom: '01:00' })] })
    const due = dueReminders(value, '2h', new Date('2026-06-28T21:30:00.000Z'), 'Europe/Berlin', 60)
    expect(due).toEqual([expect.objectContaining({
      offset: '2h', scheduledAt: '2026-06-28T23:00:00.000Z',
      localDate: '2026-06-29', time: '01:00', planVersionId: 'v1',
    })])
  })

  it('uses an absolute 1day offset across the spring DST boundary', () => {
    const value = timeline({ versions: [version({ intake_time: 'morgens' })] })
    const due = dueReminders(value, '1day', new Date('2026-03-28T06:30:00.000Z'), 'Europe/Berlin', 60)
    expect(due).toEqual([expect.objectContaining({
      offset: '1day', scheduledAt: '2026-03-29T06:00:00.000Z',
      localDate: '2026-03-29', time: '08:00',
    })])
  })

  it('returns per-slot quantity and exact plan provenance without a latest-version guess', () => {
    const value = timeline({ versions: [
      version({ id: 'old', intake_time: 'morgens,abends', slot_doses: '5,6' }),
      version({
        id: 'new', effective_kind: 'instant', effective_at: '2026-06-29T10:00:00.000Z',
        effective_local_date: null, intake_time: 'morgens,abends', slot_doses: '15,16',
        unit: 'ml', method: 'injection',
      }),
    ] })
    const due = dueReminders(value, 'on_time', new Date('2026-06-29T06:30:00.000Z'), 'Europe/Berlin', 60)
    expect(due).toEqual([expect.objectContaining({
      offset: 'on_time', cycleId: 'c1', stackItemId: 's1', planVersionId: 'old',
      scheduledAt: '2026-06-29T06:00:00.000Z',
      routineSlotKey: 'c1@2026-06-29T06:00:00.000Z', slotKey: 'morgens',
      dose: 5, unit: 'mg', method: 'oral',
    })])
  })

  it('suppresses PRN and paused occurrences but keeps a slot before a later pause', () => {
    const prn = timeline({ versions: [version({ frequency: 'Bei Bedarf' })] })
    expect(dueReminders(prn, 'on_time', new Date('2026-06-29T06:30:00.000Z'), 'Europe/Berlin', 60)).toEqual([])

    const pausedLater = timeline({
      versions: [version({ intake_time: 'morgens,abends' })],
      pauses: [{ id: 'p1', cycle_id: 'c1', paused_at: '2026-06-29T10:00:00.000Z', ends_at: null }],
    })
    expect(dueReminders(pausedLater, 'on_time', new Date('2026-06-29T06:30:00.000Z'), 'Europe/Berlin', 60))
      .toEqual([expect.objectContaining({ time: '08:00', planVersionId: 'v1' })])
    expect(dueReminders(pausedLater, 'on_time', new Date('2026-06-29T18:30:00.000Z'), 'Europe/Berlin', 60)).toEqual([])
  })

  it('keeps cycle-level reminder defaults and explicit none', () => {
    expect(reminderKeys(null)).toEqual(['on_time'])
    expect(reminderKeys('')).toEqual(['on_time'])
    expect(reminderKeys('none')).toEqual([])
    expect(reminderKeys('on_time,2h,unknown')).toEqual(['on_time', '2h'])
  })
})

describe('reminder worker boundary', () => {
  it.each([
    { archived: true, configuration_status: 'complete', migration_conflicts: [] },
    { archived: false, configuration_status: 'needs_review', migration_conflicts: [] },
    { archived: false, configuration_status: 'complete', migration_conflicts: [{ resolved_at: null }] },
  ])('sends no contradictory or archived dues, then resumes the selected cycle: %j', async item => {
    const sendNotification = vi.fn().mockResolvedValue(undefined)
    const cycles = [1, 2].map(dose => cycleRow({
      id: `c${dose}`, active: false, stack_items: { display_name: 'Exact peptide', ...item },
      versions: [version({ dose })],
    }))
    const input = {
      subscriptions: [{ user_id: 'u1', endpoint: 'test', subscription: {}, timezone: 'Europe/Berlin' }],
      cycles, now: new Date('2026-06-29T06:30:00.000Z'), windowMin: 60, sendNotification,
    }
    await expect(sendRemindersForSubscriptions(input)).resolves.toMatchObject({ sent: 0 })
    expect(sendNotification).not.toHaveBeenCalled()
    cycles[0].ended_at = '2026-06-28T00:00:00Z'
    cycles[1].stack_items = { display_name: 'Exact peptide', archived: false, configuration_status: 'complete', migration_conflicts: [] }
    await expect(sendRemindersForSubscriptions(input)).resolves.toMatchObject({ sent: 1 })
    expect(JSON.parse(sendNotification.mock.calls[0][1])).toMatchObject({ title: '💊 Exact peptide', body: '2 mg · 08:00 Uhr – jetzt einnehmen' })
  })

  it('maps relational rows to the client timeline shape', () => {
    const row = cycleRow()
    expect(mapTimelineRow(row)).toEqual({
      cycle: { id: 'c1', stack_item_id: 's1', started_at: '2026-01-01T00:00:00.000Z', ended_at: null },
      versions: row.versions,
      pauses: row.pauses,
    })
  })

  it('queries open relational timelines without legacy schedule or escalation reads', () => {
    const url = decodeURIComponent(buildCyclesUrl('https://example.supabase.co', ['u1', 'u2']))
    expect(url).toContain('/rest/v1/cycles?ended_at=is.null&user_id=in.("u1","u2")')
    expect(url).toContain('started_at,ended_at')
    expect(url).toContain('stack_items(display_name,archived,configuration_status,migration_conflicts:cycle_migration_conflicts(resolved_at))')
    expect(url).not.toContain('peptides(')
    expect(url).toContain('versions:cycle_plan_versions')
    expect(url).toContain('pauses:cycle_pause_periods')
    expect(url).not.toContain('active=eq.true')
    expect(url).not.toContain('schedule_history')
    expect(url).not.toContain('dose_escalations')
  })

  it('builds payload quantity and tag from the exact normalized occurrence', () => {
    const due = {
      offset: 'on_time', cycleId: 'c1', planVersionId: 'old',
      routineSlotKey: 'c1@2026-06-29T06:00:00.000Z', time: '08:00',
      dose: 5, unit: 'mg',
    }
    expect(payloadFor(cycleRow(), due)).toEqual({
      title: '💊 Exact peptide',
      body: '5 mg · 08:00 Uhr – jetzt einnehmen',
      url: '/kalender',
      tag: 'dose-c1@2026-06-29T06:00:00.000Z-on_time',
    })
  })

  it('preserves a finite positive quantity below two-decimal precision', () => {
    const payload = payloadFor(cycleRow(), {
      offset: 'on_time', cycleId: 'c1', routineSlotKey: 'c1@slot', time: '08:00',
      dose: 0.001, unit: 'mg',
    })

    expect(payload.body).toBe('0.001 mg · 08:00 Uhr – jetzt einnehmen')
  })

  it('keeps a useful time-only payload when quantity is absent or invalid', () => {
    for (const [dose, unit] of [[null, null], [0, 'mg'], [5, '']]) {
      const payload = payloadFor(cycleRow(), {
        offset: '2h', cycleId: 'c1', routineSlotKey: 'c1@slot', time: '08:00', dose, unit,
      })
      expect(payload.body).toBe('in 2 Stunden (08:00 Uhr)')
      expect(payload.body).not.toContain('0 mg')
      expect(payload.body).not.toContain('null')
      expect(payload.body).not.toContain('undefined')
    }
  })

  it('evaluates two subscriptions for one user in their own stored zones', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined)
    const result = await sendRemindersForSubscriptions({
      subscriptions: [
        { user_id: 'u1', endpoint: 'berlin', subscription: { endpoint: 'berlin' }, timezone: 'Europe/Berlin' },
        { user_id: 'u1', endpoint: 'new-york', subscription: { endpoint: 'new-york' }, timezone: 'America/New_York' },
      ],
      cycles: [cycleRow()],
      now: new Date('2026-06-29T06:30:00.000Z'),
      windowMin: 60,
      sendNotification,
      logError: vi.fn(),
    })

    expect(sendNotification).toHaveBeenCalledTimes(1)
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: 'berlin' },
      expect.stringContaining('08:00 Uhr'),
    )
    expect(result).toEqual({ sent: 1, failed: 0, dueUsers: 1, stale: [] })
  })

  it('logs bad subscription zones, sends nothing to them, and continues valid subscriptions', async () => {
    const sendNotification = vi.fn().mockResolvedValue(undefined)
    const logError = vi.fn()
    const sensitiveEndpoint = 'https://push.example/send/secret-capability-token'
    const sensitiveUserId = 'user-secret-42'
    const sensitiveTimeZone = 'Secret/Invalid-Zone'
    const result = await sendRemindersForSubscriptions({
      subscriptions: [
        {
          user_id: sensitiveUserId,
          endpoint: sensitiveEndpoint,
          subscription: { endpoint: sensitiveEndpoint },
          timezone: sensitiveTimeZone,
        },
        { user_id: 'user-missing-zone', endpoint: 'missing-zone-token', subscription: { endpoint: 'missing-zone-token' }, timezone: null },
        { user_id: 'u1', endpoint: 'valid', subscription: { endpoint: 'valid' }, timezone: 'Europe/Berlin' },
      ],
      cycles: [cycleRow()],
      now: new Date('2026-06-29T06:30:00.000Z'),
      windowMin: 60,
      sendNotification,
      logError,
    })

    expect(sendNotification).toHaveBeenCalledTimes(1)
    expect(sendNotification).toHaveBeenCalledWith({ endpoint: 'valid' }, expect.any(String))
    expect(logError).toHaveBeenCalledTimes(2)
    expect(logError).toHaveBeenNthCalledWith(1, 'Reminder subscription skipped: invalid timezone')
    expect(logError).toHaveBeenNthCalledWith(2, 'Reminder subscription skipped: invalid timezone')
    const logged = JSON.stringify(logError.mock.calls)
    expect(logged).not.toContain(sensitiveEndpoint)
    expect(logged).not.toContain(sensitiveUserId)
    expect(logged).not.toContain(sensitiveTimeZone)
    expect(logged).not.toContain('missing-zone-token')
    expect(logged).not.toContain('user-missing-zone')
    expect(result).toEqual({ sent: 1, failed: 2, dueUsers: 1, stale: [] })
  })
})
