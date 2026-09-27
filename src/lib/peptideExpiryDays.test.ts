import { describe, expect, it } from 'vitest'
import { expiryDaysLeft } from './peptideExpiry'

describe('expiryDaysLeft', () => {
  // Angemischt am 20.09., 8 Tage haltbar: laeuft am 28.09. ab.
  const vial = { reconstitution_date: '2026-09-20', expiry_days: 8 }

  it('zählt Kalendertage: am Ablauftag 0, nicht schon am Vortag', () => {
    expect(expiryDaysLeft(vial, new Date(2026, 8, 27, 10, 0))).toBe(1)
    expect(expiryDaysLeft(vial, new Date(2026, 8, 28, 0, 30))).toBe(0)
    expect(expiryDaysLeft(vial, new Date(2026, 8, 28, 23, 0))).toBe(0)
  })

  it('wird negativ, sobald es abgelaufen ist', () => {
    expect(expiryDaysLeft(vial, new Date(2026, 8, 29, 8, 0))).toBe(-1)
    expect(expiryDaysLeft(vial, new Date(2026, 9, 1, 8, 0))).toBe(-3)
  })

  it('weiß nichts ohne Anmischdatum oder Haltbarkeit', () => {
    expect(expiryDaysLeft({ reconstitution_date: null, expiry_days: 8 })).toBeNull()
    expect(expiryDaysLeft({ reconstitution_date: '2026-09-20', expiry_days: null })).toBeNull()
  })
})
