import { describe, expect, it } from 'vitest'
import type { CycleTimeline } from '../../../lib/planTimeline'
import { MAX_ZEILEN, zyklusZeilen } from './zyklusZeilen'

const timeZone = 'Europe/Berlin'

/** Ende exklusiv wie in der Datenbank: `ende` ist der Tag nach dem letzten. */
function zyklus(id: string, stackItemId: string, start: string, ende: string | null): CycleTimeline {
  return {
    cycle: {
      id, stack_item_id: stackItemId,
      started_at: `${start}T00:00:00.000Z`, start_local_date: start,
      ended_at: ende ? `${ende}T00:00:00.000Z` : null, end_local_date: ende,
    },
    versions: [],
    pauses: [],
  }
}

const namen = new Map([['bpc', 'BPC-157'], ['tb', 'TB-500'], ['sema', 'Semaglutid']])
// 100 Tage: 2026-01-01 bis 2026-04-10
const fenster = { von: '2026-01-01', bis: '2026-04-10' }

describe('Zyklen als Zeitstreifen', () => {
  it('legt Zyklen einer Substanz in eine Zeile, zugeschnitten aufs Fenster', () => {
    const { zeilen, weitere } = zyklusZeilen([
      zyklus('c1', 'bpc', '2025-12-01', '2026-01-11'),
      zyklus('c2', 'bpc', '2026-03-12', null),
    ], namen, fenster, '2026-04-10', timeZone)

    expect(weitere).toBe(0)
    expect(zeilen).toHaveLength(1)
    const [z] = zeilen
    expect(z.substanz).toBe('BPC-157')
    expect(z.abschnitte.map(a => [a.von, a.bis])).toEqual([['2025-12-01', '2026-01-10'], ['2026-03-12', null]])
    // vor dem Fenster begonnen: bei 0 abgeschnitten; 10 Tage im Fenster
    expect(z.abschnitte[0].start).toBe(0)
    expect(z.abschnitte[0].ende).toBeCloseTo(0.1)
    // laeuft bis heute = Fensterende
    expect(z.abschnitte[1].start).toBeCloseTo(0.7)
    expect(z.abschnitte[1].ende).toBe(1)
  })

  it('laesst Zyklen ausserhalb des Fensters weg', () => {
    const { zeilen } = zyklusZeilen([zyklus('c1', 'tb', '2025-01-01', '2025-02-01')], namen, fenster, '2026-04-10', timeZone)
    expect(zeilen).toEqual([])
  })

  it('Farbe folgt der Substanz, nicht der Reihenfolge im Fenster', () => {
    const timelines = [
      zyklus('alt', 'sema', '2025-06-01', '2025-07-01'),
      zyklus('c1', 'tb', '2026-02-01', '2026-03-01'),
      zyklus('c2', 'bpc', '2026-01-05', '2026-01-20'),
    ]
    const { zeilen } = zyklusZeilen(timelines, namen, fenster, '2026-04-10', timeZone)
    // Plaetze nach erstem Start ueberhaupt: sema 0, bpc 1, tb 2. sema ist nicht
    // im Fenster — die anderen behalten trotzdem ihre Plaetze statt aufzuruecken.
    expect(zeilen.map(z => [z.substanz, z.farbe])).toEqual([['BPC-157', 1], ['TB-500', 2]])
  })

  it('zeigt hoechstens sechs Zeilen und zaehlt den Rest', () => {
    const viele = Array.from({ length: 8 }, (_, i) => zyklus(`c${i}`, `s${i}`, `2026-02-0${i + 1}`, '2026-03-01'))
    const { zeilen, weitere } = zyklusZeilen(viele, new Map(), fenster, '2026-04-10', timeZone)
    expect(zeilen).toHaveLength(MAX_ZEILEN)
    expect(weitere).toBe(2)
    expect(zeilen[0].substanz).toBe('—')
  })

  it('am Starttag beendet: ein Tag, nicht rueckwaerts', () => {
    const { zeilen } = zyklusZeilen([zyklus('c1', 'bpc', '2026-02-10', '2026-02-10')], namen, fenster, '2026-04-10', timeZone)
    const [a] = zeilen[0].abschnitte
    expect(a.bis).toBe('2026-02-10')
    expect(a.ende).toBeGreaterThan(a.start)
  })
})
