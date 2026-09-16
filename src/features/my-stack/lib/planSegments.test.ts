import { describe, expect, it } from 'vitest'
import { planSegments, kuenftigeStufen, stufenText } from './planSegments'
import type { ScheduleCycle, ScheduleSegment } from '../../../lib/intakeSchedule'

const stufe = (effective_from: string, slot_doses: string): ScheduleSegment => ({
  effective_from,
  frequency: 'Täglich',
  x_days_interval: null,
  schedule_days: null,
  intake_time: 'morgens,abends',
  intake_time_custom: '08:00,20:00',
  dose: Number(slot_doses.split(',')[0]),
  unit: 'mg',
  slot_doses,
})

const zyklus = (teile: Partial<ScheduleCycle> = {}): ScheduleCycle => ({
  id: 'c1',
  stack_item_id: 's1',
  start_date: '2026-09-01',
  end_date: null,
  frequency: 'Täglich',
  x_days_interval: null,
  schedule_days: null,
  intake_time: 'morgens,abends',
  intake_time_custom: '08:00,20:00',
  dose: 1000,
  unit: 'mg',
  schedule_history: null,
  slot_doses: '1000,500',
  ...teile,
})

describe('planSegments', () => {
  it('sieht in einem Plan ohne Historie genau eine Stufe: ihn selbst', () => {
    // So steht jeder Plan da, der nie geändert wurde — und so muss er
    // dastehen, sonst wäre die Liste bei 148 von 148 Zyklen leer.
    const stufen = planSegments(zyklus(), new Date(2026, 8, 16))

    expect(stufen).toHaveLength(1)
    expect(stufen[0].effectiveFrom).toBe('2026-09-01')
    expect(stufen[0].status).toBe('current')
    expect(stufen[0].segment.slot_doses).toBe('1000,500')
  })

  it('markiert die Stufe, die jetzt gilt — nach derselben Regel wie der Kalender', () => {
    // Genau der Fall aus der Fragestellung: morgens gesteigert, abends gleich.
    const stufen = planSegments(zyklus({
      schedule_history: [
        stufe('2026-09-01', '250,500'),
        stufe('2026-10-01', '500,500'),
        stufe('2026-10-15', '750,500'),
      ],
    }), new Date(2026, 8, 16))

    expect(stufen.map(s => [s.effectiveFrom, s.status])).toEqual([
      ['2026-09-01', 'current'],
      ['2026-10-01', 'future'],
      ['2026-10-15', 'future'],
    ])
  })

  it('schiebt die laufende Stufe weiter, sobald die nächste angefangen hat', () => {
    const drei = zyklus({
      schedule_history: [
        stufe('2026-09-01', '250,500'),
        stufe('2026-10-01', '500,500'),
        stufe('2026-10-15', '750,500'),
      ],
    })

    expect(planSegments(drei, new Date(2026, 9, 20)).map(s => s.status))
      .toEqual(['past', 'past', 'current'])
  })

  it('kennt noch keine laufende Stufe, solange die erste in der Zukunft liegt', () => {
    const stufen = planSegments(zyklus({
      start_date: '2026-12-01',
      schedule_history: [stufe('2026-12-01', '250,500')],
    }), new Date(2026, 8, 16))

    expect(stufen.map(s => s.status)).toEqual(['future'])
  })

  it('sortiert nach Stichtag und lässt bei gleichem Datum die spätere gelten', () => {
    // Der RPC ersetzt beim Speichern — eine Altzeile könnte es trotzdem
    // doppelt tragen, und dann darf die Liste nicht zweimal dasselbe zeigen.
    const stufen = planSegments(zyklus({
      schedule_history: [
        stufe('2026-10-01', '500,500'),
        stufe('2026-09-01', '250,500'),
        stufe('2026-10-01', '600,500'),
      ],
    }), new Date(2026, 8, 16))

    expect(stufen.map(s => s.effectiveFrom)).toEqual(['2026-09-01', '2026-10-01'])
    expect(stufen[1].segment.slot_doses).toBe('600,500')
  })

  it('gibt als zurücknehmbar nur her, was noch nicht angefangen hat', () => {
    const drei = zyklus({
      schedule_history: [
        stufe('2026-09-01', '250,500'),
        stufe('2026-10-01', '500,500'),
        stufe('2026-10-15', '750,500'),
      ],
    })

    expect(kuenftigeStufen(drei, new Date(2026, 8, 16)).map(s => s.effectiveFrom))
      .toEqual(['2026-10-01', '2026-10-15'])
    // Eine Stufe, die läuft, ist eingetreten — sie lässt sich nicht wegnehmen.
    expect(kuenftigeStufen(drei, new Date(2026, 9, 20))).toEqual([])
  })
})

describe('stufenText', () => {
  it('nennt je Einnahme die Uhrzeit und ihre Menge', () => {
    expect(stufenText(stufe('2026-10-01', '250,500')))
      .toBe('08:00 · 250 mg + 20:00 · 500 mg')
  })

  it('nimmt die Menge des Zyklus, wo ein Zeitpunkt keine eigene hat', () => {
    expect(stufenText({ ...stufe('2026-10-01', '250,500'), slot_doses: null, dose: 400 }))
      .toBe('08:00 · 400 mg + 20:00 · 400 mg')
  })

  it('lässt die Menge weg, wo keine getrackt wird', () => {
    expect(stufenText({ ...stufe('2026-10-01', '250,500'), slot_doses: null, dose: null, unit: null }))
      .toBe('08:00 + 20:00')
  })

  it('fällt auf die Standardzeit der Tageszeit zurück', () => {
    expect(stufenText({ ...stufe('2026-10-01', '250,500'), intake_time_custom: null }))
      .toBe('08:00 · 250 mg + 20:00 · 500 mg')
  })
})
