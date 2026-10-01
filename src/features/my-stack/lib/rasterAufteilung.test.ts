import { describe, expect, it } from 'vitest'
import { rasterAufteilung } from './rasterAufteilung'

// Die Flaeche unter Kopf und Reitern auf einem iPhone 13.
const IPHONE = { breite: 366, hoehe: 470 }

describe('rasterAufteilung', () => {
  it.each([
    [1, 1, 1],
    [2, 2, 1],
    [4, 2, 2],
    [6, 3, 2],
    [9, 3, 3],
    [12, 3, 4],
  ])('%i Substanzen: %i × %i, ohne Scrollen', (anzahl, spalten, zeilen) => {
    const raster = rasterAufteilung({ anzahl, ...IPHONE })
    expect(raster).toMatchObject({ spalten, zeilen, passt: true })
    // Alle Zeilen passen in die Hoehe.
    expect(zeilen * raster.kachelHoehe + (zeilen - 1) * 12).toBeLessThanOrEqual(IPHONE.hoehe)
  })

  it('wird ab 13 Substanzen gescrollt statt unter die Lesbarkeit verkleinert', () => {
    const raster = rasterAufteilung({ anzahl: 13, ...IPHONE })
    expect(raster.passt).toBe(false)
    expect(raster.spalten).toBe(3)
    expect(raster.kachelHoehe).toBeGreaterThanOrEqual(100)
  })

  it('nie mehr als drei Spalten auf dem iPhone, auch bei vielen Eintraegen', () => {
    expect(rasterAufteilung({ anzahl: 40, ...IPHONE }).spalten).toBe(3)
  })

  it('mehr Spalten, wo die Breite es hergibt (Tablet quer)', () => {
    const raster = rasterAufteilung({ anzahl: 12, breite: 1000, hoehe: 640 })
    expect(raster.spalten).toBeGreaterThan(3)
    expect(raster.passt).toBe(true)
  })

  it('eine einzelne Substanz wird nicht absurd breit, sondern hochkant', () => {
    const raster = rasterAufteilung({ anzahl: 1, ...IPHONE })
    expect(raster.kachelHoehe).toBeLessThanOrEqual(IPHONE.hoehe)
    expect(raster.kachelHoehe).toBeGreaterThan(300)
  })

  it('ohne Eintraege oder Flaeche: leer, kein Fehler', () => {
    expect(rasterAufteilung({ anzahl: 0, ...IPHONE })).toMatchObject({ zeilen: 0, passt: true })
    expect(rasterAufteilung({ anzahl: 3, breite: 0, hoehe: 0 })).toMatchObject({ zeilen: 0 })
  })
})
