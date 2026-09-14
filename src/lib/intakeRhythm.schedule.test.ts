import { addDays, format, parseISO } from 'date-fns'
import { describe, expect, it } from 'vitest'
import { cycleAppliesToDay, type ScheduleCycle } from './intakeSchedule'

// Der Rhythmus als vier Formen statt als Liste fester Texte. Diese Tests
// halten fest, was die vier bedeuten. Dass der Push-Cron dasselbe sagt, prueft
// `api/_lib/reminderSchedule.parity.test.js` — beide haben eine eigene Kopie
// der Regel, weil die api/-Functions nicht aus src/ importieren koennen.

function zyklus(teile: Partial<ScheduleCycle> = {}): ScheduleCycle {
  return {
    id: 'c1',
    stack_item_id: 's1',
    start_date: '2026-01-31',
    end_date: null,
    frequency: 'Täglich',
    x_days_interval: null,
    schedule_days: null,
    intake_time: 'morgens',
    intake_time_custom: null,
    dose: 1,
    unit: 'mg',
    schedule_history: null,
    ...teile,
  }
}

/** Die Tage, an denen der Zyklus in einem Zeitraum greift. */
function treffer(cycle: ScheduleCycle, von: string, tage: number): string[] {
  const start = parseISO(von)
  const raus: string[] = []
  for (let i = 0; i < tage; i += 1) {
    const tag = addDays(start, i)
    if (cycleAppliesToDay(cycle, tag)) raus.push(format(tag, 'yyyy-MM-dd'))
  }
  return raus
}

describe('Rhythmus: im Abstand von', () => {
  it('zählt Wochen als sieben Tage', () => {
    const alleZweiWochen = zyklus({
      start_date: '2026-03-02',
      frequency: 'Alle X Tage',
      x_days_interval: 2,
      interval_unit: 'week',
    })

    expect(treffer(alleZweiWochen, '2026-03-02', 30)).toEqual([
      '2026-03-02', '2026-03-16', '2026-03-30',
    ])
  })

  it('erlaubt Abstände, die als „Alle X Tage" nie gingen', () => {
    // Ein Depot alle zehn Wochen. Die alte Prüfung ließ höchstens 30 Tage zu.
    const depot = zyklus({
      start_date: '2026-01-05',
      frequency: 'Alle X Tage',
      x_days_interval: 10,
      interval_unit: 'week',
    })

    expect(treffer(depot, '2026-01-05', 200)).toEqual([
      '2026-01-05', '2026-03-16', '2026-05-25',
    ])
  })

  it('rechnet Monate über den Kalender, nicht über 30 Tage', () => {
    const allDreiMonate = zyklus({
      start_date: '2026-01-15',
      frequency: 'Alle X Tage',
      x_days_interval: 3,
      interval_unit: 'month',
    })

    expect(treffer(allDreiMonate, '2026-01-15', 370)).toEqual([
      '2026-01-15', '2026-04-15', '2026-07-15', '2026-10-15', '2027-01-15',
    ])
  })

  it('kappt am Monatsende auf den letzten Tag — wie ein Kalender', () => {
    // Start am 31. Januar, monatlich: der Februar hat keinen 31.
    const monatlich = zyklus({
      start_date: '2026-01-31',
      frequency: 'Alle X Tage',
      x_days_interval: 1,
      interval_unit: 'month',
    })

    expect(treffer(monatlich, '2026-01-31', 90)).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ])
  })

  it('behandelt ein fehlendes interval_unit als Tage — wie alte Zyklen', () => {
    const alt = zyklus({ start_date: '2026-03-02', frequency: 'Alle X Tage', x_days_interval: 3 })

    expect(treffer(alt, '2026-03-02', 10))
      .toEqual(['2026-03-02', '2026-03-05', '2026-03-08', '2026-03-11'])
  })
})

describe('Rhythmus: im Wechsel', () => {
  it('nimmt X Tage am Stück und pausiert dann Y', () => {
    // Die Pille: 21 an, 7 aus.
    const pille = zyklus({
      start_date: '2026-03-02',
      frequency: 'Im Wechsel',
      cycle_on_days: 21,
      cycle_off_days: 7,
    })
    const tage = treffer(pille, '2026-03-02', 56)

    expect(tage).toHaveLength(42)
    expect(tage[20]).toBe('2026-03-22')   // letzter Tag des ersten Blocks
    expect(tage).not.toContain('2026-03-23')
    expect(tage).not.toContain('2026-03-29')
    expect(tage[21]).toBe('2026-03-30')   // der neue Block beginnt
  })

  it('weist unbrauchbare Zahlen ab, statt sie zu erraten', () => {
    for (const teile of [
      { cycle_on_days: null, cycle_off_days: 7 },
      { cycle_on_days: 21, cycle_off_days: null },
      { cycle_on_days: 0, cycle_off_days: 7 },
      { cycle_on_days: 91, cycle_off_days: 7 },
    ]) {
      const kaputt = zyklus({ start_date: '2026-03-02', frequency: 'Im Wechsel', ...teile })
      expect(cycleAppliesToDay(kaputt, parseISO('2026-03-02')), JSON.stringify(teile)).toBe(false)
    }
  })
})

describe('Alte Frequenztexte gelten weiter', () => {
  it.each([
    ['Jeden 2. Tag', ['2026-03-02', '2026-03-04', '2026-03-06', '2026-03-08', '2026-03-10']],
    ['Wöchentlich', ['2026-03-02', '2026-03-09']],
    ['5 Tage an / 2 aus', ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10']],
    ['Mo-Fr', ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10']],
  ])('%s', (frequency, erwartet) => {
    // Bestehende Zyklen tragen diese Texte. Das Formular schreibt sie nicht
    // mehr, aber sie duerfen ihre Bedeutung nicht verlieren.
    const tage = treffer(zyklus({ start_date: '2026-03-02', frequency }), '2026-03-02', 9)
    expect(tage).toEqual(erwartet)
  })
})
