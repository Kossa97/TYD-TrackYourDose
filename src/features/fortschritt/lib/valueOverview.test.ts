import { describe, expect, it } from 'vitest'
import type { DailyLogEntry } from '../types'
import {
  buildValueOverview,
  splitValueOverviewRange,
} from './valueOverview'

const log = (
  log_date: string,
  values: Partial<Omit<DailyLogEntry, 'log_date'>>,
): DailyLogEntry => ({
  log_date,
  energie: null,
  schlaf: null,
  wohlbefinden: null,
  libido: null,
  body_fat_pct: null,
  ...values,
})

describe('splitValueOverviewRange', () => {
  it('legt bei einer ungeraden Tageszahl den zusätzlichen Tag in die zweite Hälfte', () => {
    expect(splitValueOverviewRange({ from: '2026-07-01', to: '2026-07-05' })).toEqual({
      first: { from: '2026-07-01', to: '2026-07-02' },
      second: { from: '2026-07-03', to: '2026-07-05' },
    })
  })

  it('behandelt einen einzelnen Tag als ausschließlich zweite Hälfte', () => {
    expect(splitValueOverviewRange({ from: '2026-07-05', to: '2026-07-05' })).toEqual({
      first: null,
      second: { from: '2026-07-05', to: '2026-07-05' },
    })
  })
})

describe('buildValueOverview', () => {
  it('zeigt den neueren Durchschnitt ab einem Wert, aber noch keinen Vergleich', () => {
    const rows = buildValueOverview(
      [log('2026-07-04', { energie: 8 })],
      { from: '2026-07-01', to: '2026-07-04' },
    )

    expect(rows.find(row => row.key === 'energie')).toMatchObject({
      average: 8,
      delta: null,
      tone: 'neutral',
      direction: null,
    })
  })

  it('berechnet nur Metriken mit mindestens zwei Werten pro Hälfte', () => {
    const rows = buildValueOverview([
      log('2026-07-01', { energie: 5, schlaf: 6 }),
      log('2026-07-02', { energie: 7 }),
      log('2026-07-03', { energie: 8, schlaf: 8 }),
      log('2026-07-04', { energie: 10 }),
    ], { from: '2026-07-01', to: '2026-07-04' })

    expect(rows.find(row => row.key === 'energie')).toMatchObject({ average: 9, delta: 3 })
    expect(rows.find(row => row.key === 'schlaf')).toMatchObject({ average: 8, delta: null })
  })

  it('liefert alle fünf Zeilen in der freigegebenen Reihenfolge', () => {
    const rows = buildValueOverview([], { from: '2026-07-01', to: '2026-07-04' })
    expect(rows.map(row => row.key)).toEqual([
      'energie', 'schlaf', 'wohlbefinden', 'libido', 'body_fat_pct',
    ])
    expect(rows.every(row => row.average === null && row.delta === null)).toBe(true)
  })

  it('rundet Durchschnitt und Delta auf eine Nachkommastelle', () => {
    const rows = buildValueOverview([
      log('2026-07-01', { energie: 5.1 }),
      log('2026-07-02', { energie: 5.2 }),
      log('2026-07-03', { energie: 6.2 }),
      log('2026-07-04', { energie: 6.3 }),
    ], { from: '2026-07-01', to: '2026-07-04' })

    expect(rows.find(row => row.key === 'energie')).toMatchObject({
      average: 6.3,
      delta: 1.1,
    })
  })
})


describe('Statusfarben', () => {
  it('klassifiziert Wellness-Verbesserung, leichte und deutliche Verschlechterung', () => {
    const rows = buildValueOverview([
      log('2026-07-01', { energie: 5, schlaf: 8, wohlbefinden: 8 }),
      log('2026-07-02', { energie: 5, schlaf: 8, wohlbefinden: 8 }),
      log('2026-07-03', { energie: 5.2, schlaf: 7.5, wohlbefinden: 7 }),
      log('2026-07-04', { energie: 5.2, schlaf: 7.5, wohlbefinden: 7 }),
    ], { from: '2026-07-01', to: '2026-07-04' })

    expect(rows.find(row => row.key === 'energie')).toMatchObject({
      delta: 0.2, tone: 'positive', direction: 'up',
    })
    expect(rows.find(row => row.key === 'schlaf')).toMatchObject({
      delta: -0.5, tone: 'warning', direction: 'down',
    })
    expect(rows.find(row => row.key === 'wohlbefinden')).toMatchObject({
      delta: -1, tone: 'negative', direction: 'down',
    })
  })

  it('behandelt sinkenden KFA als Verbesserung und steigenden KFA als Warnung', () => {
    const improved = buildValueOverview([
      log('2026-07-01', { body_fat_pct: 18 }),
      log('2026-07-02', { body_fat_pct: 18 }),
      log('2026-07-03', { body_fat_pct: 17.8 }),
      log('2026-07-04', { body_fat_pct: 17.8 }),
    ], { from: '2026-07-01', to: '2026-07-04' })
    const worsened = buildValueOverview([
      log('2026-07-01', { body_fat_pct: 18 }),
      log('2026-07-02', { body_fat_pct: 18 }),
      log('2026-07-03', { body_fat_pct: 18.5 }),
      log('2026-07-04', { body_fat_pct: 18.5 }),
    ], { from: '2026-07-01', to: '2026-07-04' })

    expect(improved.at(-1)).toMatchObject({
      delta: -0.2, tone: 'positive', direction: 'down',
    })
    expect(worsened.at(-1)).toMatchObject({
      delta: 0.5, tone: 'warning', direction: 'up',
    })
  })

  it('lässt Änderungen unter 0,2 neutral', () => {
    const rows = buildValueOverview([
      log('2026-07-01', { libido: 6 }),
      log('2026-07-02', { libido: 6 }),
      log('2026-07-03', { libido: 6.1 }),
      log('2026-07-04', { libido: 6.1 }),
    ], { from: '2026-07-01', to: '2026-07-04' })

    expect(rows.find(row => row.key === 'libido')).toMatchObject({
      delta: 0.1, tone: 'neutral', direction: 'flat',
    })
  })
})
