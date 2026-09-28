import { describe, expect, it } from 'vitest'
import type { PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { groupPlanCardSlots, inclusiveDayCount, planCardSlots, planDisplaySlots, planStepRows } from './planCard'

function snapshot(changes: Partial<PlanScheduleSnapshot> = {}): PlanScheduleSnapshot {
  return {
    frequency: 'Täglich',
    x_days_interval: null,
    interval_unit: null,
    cycle_on_days: null,
    cycle_off_days: null,
    schedule_days: [],
    intake_time: 'morgens,abends',
    intake_time_custom: '08:00,20:00',
    slot_doses: null,
    slot_days: null,
    dose: 250,
    unit: 'mcg',
    method: 'Subkutan',
    ...changes,
  }
}

describe('planCardSlots', () => {
  it('gives every intake time its own weekdays, empty for every day', () => {
    const slots = planCardSlots(snapshot({ slot_doses: '500,250', slot_days: ',Mo|Mi|Fr' }))

    expect(slots.map(slot => [slot.id, slot.time, slot.dose, slot.days])).toEqual([
      ['morgens#0', '08:00', 500, []],
      ['abends#0', '20:00', 250, ['Mo', 'Mi', 'Fr']],
    ])
  })

  it('falls back to the plan dose when a slot has none of its own', () => {
    expect(planCardSlots(snapshot()).map(slot => slot.dose)).toEqual([250, 250])
  })

  it('numbers repeated times of day so two mornings stay apart', () => {
    const slots = planCardSlots(snapshot({ intake_time: 'morgens,morgens', intake_time_custom: '10:00,07:00' }))

    // Gezaehlt wird in gespeicherter Reihenfolge, nicht nach Uhrzeit.
    expect(slots.map(slot => [slot.id, slot.time])).toEqual([['morgens#1', '07:00'], ['morgens#0', '10:00']])
  })

  it('keeps two intakes at the same time apart, each with its own weekdays', () => {
    const slots = planCardSlots(snapshot({
      intake_time: 'morgens,morgens',
      intake_time_custom: '08:00,08:00',
      slot_doses: '500,250',
      slot_days: 'Mo|Mi,Fr',
    }))

    expect(slots.map(slot => [slot.dose, slot.days])).toEqual([[500, ['Mo', 'Mi']], [250, ['Fr']]])
  })

  it('leaves out an intake the calendar never schedules instead of calling it daily', () => {
    expect(planCardSlots(snapshot({ slot_days: ',monday' })).map(slot => slot.id)).toEqual(['morgens#0'])
  })
})

describe('planStepRows', () => {
  it('marks nothing on the first step', () => {
    expect(planStepRows(snapshot(), null).map(row => row.change)).toEqual(['initial', 'initial'])
  })

  it('tells an increase, a decrease and an unchanged slot apart', () => {
    const before = snapshot({ slot_doses: '250,500' })
    const after = snapshot({ slot_doses: '500,250' })

    expect(planStepRows(after, before).map(row => [row.slot.id, row.change, row.previous?.dose])).toEqual([
      ['morgens#0', 'increased', 250],
      ['abends#0', 'decreased', 500],
    ])
    expect(planStepRows(after, after).map(row => row.change)).toEqual(['same', 'same'])
  })

  it('treats a moved time, new weekdays or another unit as a change, not a new intake', () => {
    const before = snapshot()

    expect(planStepRows(snapshot({ intake_time_custom: '09:00,20:00' }), before)[0].change).toBe('changed')
    expect(planStepRows(snapshot({ slot_days: 'Mo|Di,' }), before)[0].change).toBe('changed')
    expect(planStepRows(snapshot({ dose: 1, unit: 'mg' }), before)[0].change).toBe('changed')
  })

  it('follows an intake whose time moved past its sibling', () => {
    const before = snapshot({ intake_time: 'morgens,morgens', intake_time_custom: '07:00,10:00', slot_doses: '250,500' })
    const after = snapshot({ intake_time: 'morgens,morgens', intake_time_custom: '11:00,10:00', slot_doses: '250,500' })

    expect(planStepRows(after, before).map(row => [row.slot.time, row.previous?.time, row.change])).toEqual([
      ['10:00', '10:00', 'same'],
      ['11:00', '07:00', 'changed'],
    ])
  })

  it('lists added intake times as new and dropped ones last', () => {
    const rows = planStepRows(
      snapshot({ intake_time: 'abends,mittags', intake_time_custom: '20:00,12:00' }),
      snapshot(),
    )

    expect(rows.map(row => [row.slot.id, row.change])).toEqual([
      ['mittags#0', 'new'],
      ['abends#0', 'same'],
      ['morgens#0', 'removed'],
    ])
  })
})

describe('inclusiveDayCount', () => {
  it('counts both ends, across month and DST boundaries', () => {
    expect(inclusiveDayCount('2026-09-01', '2026-09-01')).toBe(1)
    expect(inclusiveDayCount('2026-05-31', '2026-08-12')).toBe(74)
    expect(inclusiveDayCount('2026-10-24', '2026-10-26')).toBe(3)
  })
})

describe('planDisplaySlots — gleiche Einnahmen zusammengefasst', () => {
  // So speichert der Editor „Mo und Fr, morgens und abends": je Tag eigene Stellen.
  const moUndFr = snapshot({
    frequency: 'weekdays',
    schedule_days: ['Mo', 'Fr'],
    intake_time: 'morgens,abends,morgens,abends',
    intake_time_custom: '08:00,20:00,08:00,20:00',
    slot_doses: '50,50,50,50',
    slot_days: 'Mo,Mo,Fr,Fr',
    unit: 'mg',
  })

  it('zeigt zwei Einnahmezeiten statt vier, ohne Tagesleiste, wenn sie alle Plantage abdecken', () => {
    expect(planDisplaySlots(moUndFr).map(slot => [slot.time, slot.dose, slot.days])).toEqual([
      ['08:00', 50, []],
      ['20:00', 50, []],
    ])
  })

  it('behält die Tage, wenn eine Einnahme nur an einem Teil der Plantage liegt', () => {
    const abweichend = { ...moUndFr, slot_doses: '50,50,50,100' }

    expect(planDisplaySlots(abweichend).map(slot => [slot.time, slot.dose, slot.days])).toEqual([
      ['08:00', 50, []],
      ['20:00', 50, ['Mo']],
      ['20:00', 100, ['Fr']],
    ])
  })

  it('lässt tägliche Pläne unverändert', () => {
    expect(planDisplaySlots(snapshot())).toEqual(planCardSlots(snapshot()))
  })

  it('vergleicht Stufen über die zusammengefassten Einnahmen', () => {
    const hoeher = { ...moUndFr, slot_doses: '75,75,75,75' }
    const rows = planStepRows(hoeher, moUndFr)

    expect(rows.map(row => [row.slot.time, row.change])).toEqual([
      ['08:00', 'increased'],
      ['20:00', 'increased'],
    ])
  })
})

describe('groupPlanCardSlots', () => {
  it('schluckt eine Tagesauswahl, sobald eine gleiche Einnahme an jedem Tag liegt', () => {
    const [morgens] = planCardSlots(snapshot())
    const grouped = groupPlanCardSlots([{ ...morgens, days: ['Mo'] }, { ...morgens, id: 'morgens#1', days: [] }], null)

    expect(grouped).toHaveLength(1)
    expect(grouped[0].days).toEqual([])
    expect(grouped[0].id).toBe(morgens.id)
  })
})
