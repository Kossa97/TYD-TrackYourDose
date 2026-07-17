import { describe, expect, it } from 'vitest'
import { generateProgressYear } from '../../scripts/progress-year-data'

const options = {
  userId: '00000000-0000-0000-0000-000000000001',
  startDate: '2025-07-17',
  endDate: '2026-07-17',
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

describe('generateProgressYear', () => {
  it('erzeugt für jeden Tag genau einen vollständigen Eintrag', () => {
    const { dailyRows, weightRows } = generateProgressYear(options)
    expect(dailyRows).toHaveLength(366)
    expect(weightRows).toHaveLength(366)
    expect(new Set(dailyRows.map(row => row.log_date)).size).toBe(366)
    expect(new Set(weightRows.map(row => row.logged_at.slice(0, 10))).size).toBe(366)
    expect(dailyRows.at(0)?.log_date).toBe(options.startDate)
    expect(dailyRows.at(-1)?.log_date).toBe(options.endDate)
  })

  it('trifft die Gewichts- und KFA-Endpunkte und hält alle Schema-Grenzen ein', () => {
    const { dailyRows, weightRows } = generateProgressYear(options)
    expect(weightRows.at(0)?.weight_kg).toBe(115)
    expect(weightRows.at(-1)?.weight_kg).toBe(88)
    expect(dailyRows.at(0)?.body_fat_pct).toBe(34.5)
    expect(dailyRows.at(-1)?.body_fat_pct).toBe(19)
    for (const row of dailyRows) {
      expect(row.body_fat_pct).toBeGreaterThanOrEqual(10)
      expect(row.body_fat_pct).toBeLessThanOrEqual(50)
      for (const field of ['energie', 'schlaf', 'wohlbefinden', 'libido'] as const) {
        expect(Number.isInteger(row[field])).toBe(true)
        expect(row[field]).toBeGreaterThanOrEqual(1)
        expect(row[field]).toBeLessThanOrEqual(10)
      }
    }
  })

  it('verbessert die letzten 30 Tage gegenüber den ersten 30 Tagen', () => {
    const { dailyRows, weightRows } = generateProgressYear(options)
    const firstDaily = dailyRows.slice(0, 30)
    const lastDaily = dailyRows.slice(-30)
    expect(mean(weightRows.slice(-30).map(row => row.weight_kg))).toBeLessThan(mean(weightRows.slice(0, 30).map(row => row.weight_kg)))
    expect(mean(lastDaily.map(row => row.body_fat_pct))).toBeLessThan(mean(firstDaily.map(row => row.body_fat_pct)))
    for (const field of ['energie', 'schlaf', 'wohlbefinden', 'libido'] as const) {
      expect(mean(lastDaily.map(row => row[field]))).toBeGreaterThan(mean(firstDaily.map(row => row[field])))
    }
  })

  it('liefert bei gleichen Eingaben exakt dieselben Werte', () => {
    expect(generateProgressYear(options)).toEqual(generateProgressYear(options))
  })
})
