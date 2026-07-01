import { describe, expect, it } from 'vitest'
import {
  addDaysKey,
  cycleAppliesToDay,
  daySlots,
  diffDays,
  dueReminders,
  effectiveDoseForDay,
  localParts,
  reminderKeys,
  scheduleForDay,
} from './reminderSchedule.js'

// 2026-06-29 ist ein Montag
const MONDAY = '2026-06-29'

function makeCycle(overrides = {}) {
  return {
    id: 'c1',
    user_id: 'u1',
    name: 'Test',
    dose: 250,
    unit: 'mcg',
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    start_date: '2026-06-01',
    end_date: null,
    intake_time: 'morgens',
    intake_time_custom: null,
    reminder: 'on_time',
    schedule_history: null,
    ...overrides,
  }
}

describe('localParts', () => {
  it('liefert lokales Datum und Minuten für eine Zeitzone', () => {
    // 2026-06-29T18:30Z = 20:30 in Berlin (Sommerzeit, UTC+2)
    const p = localParts(new Date('2026-06-29T18:30:00Z'), 'Europe/Berlin')
    expect(p).toEqual({ dateKey: '2026-06-29', minutes: 20 * 60 + 30 })
  })

  it('wechselt den Tag korrekt über Mitternacht', () => {
    // 22:30Z = 00:30 am Folgetag in Berlin
    const p = localParts(new Date('2026-06-29T22:30:00Z'), 'Europe/Berlin')
    expect(p).toEqual({ dateKey: '2026-06-30', minutes: 30 })
  })

  it('fällt bei ungültiger Zeitzone auf UTC zurück', () => {
    const p = localParts(new Date('2026-06-29T08:15:00Z'), 'Not/AZone')
    expect(p).toEqual({ dateKey: '2026-06-29', minutes: 8 * 60 + 15 })
  })
})

describe('Datums-Helfer', () => {
  it('diffDays und addDaysKey sind konsistent', () => {
    expect(diffDays('2026-06-29', '2026-06-01')).toBe(28)
    expect(addDaysKey('2026-06-30', 1)).toBe('2026-07-01')
    expect(addDaysKey('2026-07-01', -1)).toBe('2026-06-30')
  })
})

describe('cycleAppliesToDay', () => {
  it('respektiert start_date und end_date', () => {
    const c = makeCycle({ start_date: '2026-06-10', end_date: '2026-06-20' })
    expect(cycleAppliesToDay(c, '2026-06-09')).toBe(false)
    expect(cycleAppliesToDay(c, '2026-06-10')).toBe(true)
    expect(cycleAppliesToDay(c, '2026-06-20')).toBe(true)
    expect(cycleAppliesToDay(c, '2026-06-21')).toBe(false)
  })

  it('Jeden 2. Tag: nur gerade Abstände zum Start', () => {
    const c = makeCycle({ frequency: 'Jeden 2. Tag', start_date: '2026-06-01' })
    expect(cycleAppliesToDay(c, '2026-06-01')).toBe(true)
    expect(cycleAppliesToDay(c, '2026-06-02')).toBe(false)
    expect(cycleAppliesToDay(c, '2026-06-03')).toBe(true)
  })

  it('Alle X Tage mit Intervall', () => {
    const c = makeCycle({ frequency: 'Alle X Tage', x_days_interval: 3, start_date: '2026-06-01' })
    expect(cycleAppliesToDay(c, '2026-06-01')).toBe(true)
    expect(cycleAppliesToDay(c, '2026-06-02')).toBe(false)
    expect(cycleAppliesToDay(c, '2026-06-04')).toBe(true)
  })

  it('Mo-Fr: Wochenende ausgenommen', () => {
    const c = makeCycle({ frequency: 'Mo-Fr' })
    expect(cycleAppliesToDay(c, MONDAY)).toBe(true)           // Montag
    expect(cycleAppliesToDay(c, '2026-06-27')).toBe(false)    // Samstag
    expect(cycleAppliesToDay(c, '2026-06-28')).toBe(false)    // Sonntag
  })

  it('Wöchentlich: nur im 7-Tage-Raster ab Start', () => {
    const c = makeCycle({ frequency: 'Wöchentlich', start_date: '2026-06-01' })
    expect(cycleAppliesToDay(c, '2026-06-01')).toBe(true)
    expect(cycleAppliesToDay(c, '2026-06-04')).toBe(false)
    expect(cycleAppliesToDay(c, '2026-06-08')).toBe(true)
  })

  it('5 Tage an / 2 aus', () => {
    const c = makeCycle({ frequency: '5 Tage an / 2 aus', start_date: '2026-06-01' })
    expect(cycleAppliesToDay(c, '2026-06-05')).toBe(true)     // Tag 5 (Index 4)
    expect(cycleAppliesToDay(c, '2026-06-06')).toBe(false)    // Tag 6 (aus)
    expect(cycleAppliesToDay(c, '2026-06-08')).toBe(true)     // neue Woche
  })

  it('Wochentage wählen', () => {
    const c = makeCycle({ frequency: 'Wochentage wählen', schedule_days: ['Mo', 'Do'] })
    expect(cycleAppliesToDay(c, MONDAY)).toBe(true)           // Montag
    expect(cycleAppliesToDay(c, '2026-06-30')).toBe(false)    // Dienstag
    expect(cycleAppliesToDay(c, '2026-07-02')).toBe(true)     // Donnerstag
  })

  it('Täglich mit Tagesfilter', () => {
    const c = makeCycle({ frequency: 'Täglich', schedule_days: ['Mo'] })
    expect(cycleAppliesToDay(c, MONDAY)).toBe(true)
    expect(cycleAppliesToDay(c, '2026-06-30')).toBe(false)
  })
})

describe('scheduleForDay', () => {
  it('nutzt das jüngste Segment mit effective_from <= Tag', () => {
    const c = makeCycle({
      schedule_history: [
        { effective_from: '2026-06-01', frequency: 'Täglich', intake_time: 'morgens', intake_time_custom: null, x_days_interval: null, schedule_days: null, dose: 100, unit: 'mcg' },
        { effective_from: '2026-06-15', frequency: 'Jeden 2. Tag', intake_time: 'abends', intake_time_custom: null, x_days_interval: null, schedule_days: null, dose: 200, unit: 'mcg' },
      ],
    })
    expect(scheduleForDay(c, '2026-06-10').dose).toBe(100)
    expect(scheduleForDay(c, '2026-06-15').dose).toBe(200)
    expect(scheduleForDay(c, '2026-06-20').frequency).toBe('Jeden 2. Tag')
  })
})

describe('daySlots', () => {
  it('mischt benannte Slots und Custom-Zeiten in zeitlicher Reihenfolge', () => {
    const c = makeCycle({ intake_time: 'abends,custom,morgens', intake_time_custom: ',06:30,' })
    expect(daySlots(c, MONDAY)).toEqual([
      { minutes: 6 * 60 + 30, time: '06:30' },
      { minutes: 8 * 60, time: '08:00' },
      { minutes: 20 * 60, time: '20:00' },
    ])
  })

  it('ignoriert kaputte Custom-Zeiten', () => {
    const c = makeCycle({ intake_time: 'custom', intake_time_custom: 'abc' })
    expect(daySlots(c, MONDAY)).toEqual([])
  })
})

describe('reminderKeys', () => {
  it('Alt-Daten ohne Wahl => on_time (bisheriges Verhalten)', () => {
    expect(reminderKeys(makeCycle({ reminder: null }))).toEqual(['on_time'])
    expect(reminderKeys(makeCycle({ reminder: '' }))).toEqual(['on_time'])
  })

  it("explizites 'none' => keine Erinnerungen", () => {
    expect(reminderKeys(makeCycle({ reminder: 'none' }))).toEqual([])
  })

  it('mehrere Offsets werden geparst, Unbekanntes verworfen', () => {
    expect(reminderKeys(makeCycle({ reminder: 'on_time,2h,kaputt' }))).toEqual(['on_time', '2h'])
    expect(reminderKeys(makeCycle({ reminder: '1day' }))).toEqual(['1day'])
  })
})

describe('effectiveDoseForDay', () => {
  it('addiert Anpassungen nach Datum und nach Tagen', () => {
    const c = makeCycle({ dose: 100, start_date: '2026-06-01' })
    const esc = [
      { cycle_id: 'c1', increase_amount: 50, start_type: 'date', start_date: '2026-06-10', start_after_days: null },
      { cycle_id: 'c1', increase_amount: 25, start_type: 'after_days', start_date: null, start_after_days: 20 },
      { cycle_id: 'anderer', increase_amount: 999, start_type: 'date', start_date: '2026-06-01', start_after_days: null },
    ]
    expect(effectiveDoseForDay(c, '2026-06-05', esc)).toBe(100)
    expect(effectiveDoseForDay(c, '2026-06-10', esc)).toBe(150)
    expect(effectiveDoseForDay(c, '2026-06-21', esc)).toBe(175)
  })
})

describe('dueReminders', () => {
  const now = (dateKey, hhmm) => {
    const [h, m] = hhmm.split(':').map(Number)
    return { dateKey, minutes: h * 60 + m }
  }

  it('on_time feuert im Fenster (now-60, now]', () => {
    const c = makeCycle({ intake_time: 'morgens', reminder: 'on_time' })
    expect(dueReminders(c, now(MONDAY, '08:00'), 60)).toEqual([
      { offset: 'on_time', slotTime: '08:00', slotDateKey: MONDAY },
    ])
    expect(dueReminders(c, now(MONDAY, '08:59'), 60)).toHaveLength(1)
    expect(dueReminders(c, now(MONDAY, '09:00'), 60)).toEqual([])
    expect(dueReminders(c, now(MONDAY, '07:59'), 60)).toEqual([])
  })

  it('feuert NICHT an Off-Tagen (Kernbug: Frequenz wurde ignoriert)', () => {
    const c = makeCycle({ frequency: 'Jeden 2. Tag', start_date: '2026-06-01', reminder: 'on_time' })
    // 2026-06-29 = 28 Tage nach Start => fällig; 30.06. => Off-Tag
    expect(dueReminders(c, now('2026-06-29', '08:30'), 60)).toHaveLength(1)
    expect(dueReminders(c, now('2026-06-30', '08:30'), 60)).toEqual([])
  })

  it('2h-Offset feuert zwei Stunden vor dem Slot', () => {
    const c = makeCycle({ intake_time: 'abends', reminder: '2h' })
    expect(dueReminders(c, now(MONDAY, '18:00'), 60)).toEqual([
      { offset: '2h', slotTime: '20:00', slotDateKey: MONDAY },
    ])
    expect(dueReminders(c, now(MONDAY, '20:00'), 60)).toEqual([])
  })

  it('1day-Offset prüft den Plan von MORGEN', () => {
    // Nur-Montags-Zyklus: 1day-Erinnerung muss am Sonntag feuern
    const c = makeCycle({ frequency: 'Wochentage wählen', schedule_days: ['Mo'], intake_time: 'morgens', reminder: '1day' })
    expect(dueReminders(c, now('2026-06-28', '08:30'), 60)).toEqual([
      { offset: '1day', slotTime: '08:00', slotDateKey: MONDAY },
    ])
    expect(dueReminders(c, now(MONDAY, '08:30'), 60)).toEqual([])
  })

  it('2h-Offset über Mitternacht (Slot 01:00 => Erinnerung 23:00 am Vortag)', () => {
    const c = makeCycle({ intake_time: 'custom', intake_time_custom: '01:00', reminder: '2h' })
    expect(dueReminders(c, now('2026-06-28', '23:30'), 60)).toEqual([
      { offset: '2h', slotTime: '01:00', slotDateKey: MONDAY },
    ])
  })

  it('on_time über Mitternacht (Cron 00:05, Slot 23:50 gestern)', () => {
    const c = makeCycle({ intake_time: 'custom', intake_time_custom: '23:50', reminder: 'on_time' })
    expect(dueReminders(c, now('2026-06-30', '00:05'), 60)).toEqual([
      { offset: 'on_time', slotTime: '23:50', slotDateKey: MONDAY },
    ])
  })

  it('mehrere Offsets + mehrere Slots kombinieren sich korrekt', () => {
    const c = makeCycle({ intake_time: 'morgens,abends', reminder: 'on_time,2h' })
    // 08:30: on_time für 08:00 fällig; 2h-Erinnerung für 20:00 erst um 18:00
    expect(dueReminders(c, now(MONDAY, '08:30'), 60)).toEqual([
      { offset: 'on_time', slotTime: '08:00', slotDateKey: MONDAY },
    ])
    expect(dueReminders(c, now(MONDAY, '18:30'), 60)).toEqual([
      { offset: '2h', slotTime: '20:00', slotDateKey: MONDAY },
    ])
  })

  it("reminder='none' unterdrückt alle Pushes des Zyklus", () => {
    const c = makeCycle({ reminder: 'none' })
    expect(dueReminders(c, now(MONDAY, '08:00'), 60)).toEqual([])
  })

  it('nutzt Custom-Zeiten minutengenau statt nur Stunden-Vergleich', () => {
    const c = makeCycle({ intake_time: 'custom', intake_time_custom: '20:45', reminder: 'on_time' })
    // Stündlicher Cron um 21:00 deckt 20:45 ab; um 20:00 noch nicht
    expect(dueReminders(c, now(MONDAY, '20:00'), 60)).toEqual([])
    expect(dueReminders(c, now(MONDAY, '21:00'), 60)).toEqual([
      { offset: 'on_time', slotTime: '20:45', slotDateKey: MONDAY },
    ])
  })
})
