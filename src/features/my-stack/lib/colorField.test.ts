import { describe, expect, it } from 'vitest'
import { STACK_ITEM_COLORS } from './colors'
import { anteil, FELD_START, hexToHsv, hsvToHex, MARKEN_FARBTOENE } from './colorField'

describe('colorField', () => {
  it('kommt bei jeder Farbe unveraendert zurueck', () => {
    // Der Griff darf beim Anfassen nicht wegspringen: was hineingeht, muss
    // nach Hin- und Rueckrechnung wieder herauskommen.
    for (const hex of STACK_ITEM_COLORS) {
      const hsv = hexToHsv(hex)
      expect(hsv, hex).not.toBeNull()
      expect(hsvToHex(hsv!), hex).toBe(hex)
    }
  })

  it('rechnet die Ecken richtig', () => {
    expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe('#000000')
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe('#ffffff')
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe('#ff0000')
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00ff00')
    expect(hsvToHex({ h: 240, s: 1, v: 1 })).toBe('#0000ff')
    // 360 ist wieder 0, und negative Winkel laufen herum statt zu kippen.
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#ff0000')
    expect(hsvToHex({ h: -30, s: 1, v: 1 })).toBe(hsvToHex({ h: 330, s: 1, v: 1 }))
  })

  it('haelt Werte ausserhalb des Feldes am Rand fest', () => {
    expect(hsvToHex({ h: 190, s: 2, v: 2 })).toBe(hsvToHex({ h: 190, s: 1, v: 1 }))
    expect(hsvToHex({ h: 190, s: -1, v: -1 })).toBe('#000000')
    expect(hsvToHex({ h: 190, s: Number.NaN, v: 1 })).toBe('#ffffff')
  })

  it('nimmt Kurzschreibweise, aber keinen halben Wert', () => {
    expect(hexToHsv('#fff')).toEqual(hexToHsv('#ffffff'))
    expect(hexToHsv('  #00CCF5 ')).toEqual(hexToHsv('#00ccf5'))
    // Waehrend des Tippens steht jeder Zwischenstand im Feld — keiner davon
    // darf den Griff auf Schwarz ziehen.
    for (const halb of ['', '#', '#0', '#00', '#0000', '#00ccf', 'blau', '00ccf5']) {
      expect(hexToHsv(halb), halb).toBeNull()
    }
  })

  it('bleibt am Rand haengen, statt zu springen', () => {
    expect(anteil(50, 0, 100)).toBe(0.5)
    expect(anteil(-20, 0, 100)).toBe(0)
    expect(anteil(140, 0, 100)).toBe(1)
    // Ein Feld ohne Breite gibt es beim ersten Bild: es darf nicht NaN liefern.
    expect(anteil(50, 0, 0)).toBe(0)
  })

  it('setzt die Marken auf unsere eigenen Farbtoene', () => {
    // Die Schiene zeigt, wo die Farben der App liegen — sie schraenkt nichts
    // ein. Die Toene muessen also zu den Markenfarben passen.
    const marken = { amber: '#f59e0b', emerald: '#10b981', accent: '#00ccf5', violet: '#8b5cf6', rose: '#f43f5e' }
    for (const { name, h } of MARKEN_FARBTOENE) {
      expect(hexToHsv(marken[name])!.h, name).toBeCloseTo(h, 0)
    }
  })

  it('startet auf unserem Akzent, nicht auf Zufall oder Grau', () => {
    expect(FELD_START.h).toBeCloseTo(190, 0)
    expect(FELD_START.s).toBeGreaterThan(0.9)
  })
})
