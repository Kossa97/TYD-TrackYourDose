import { describe, expect, it } from 'vitest'
import {
  ERSCHEINEN_AB,
  ERSCHEINEN_BIS,
  ZOOM_STUFEN,
  erscheinSchwellen,
  federRuht,
  federSchritt,
  flug,
  kachelFortschritt,
  kachelMass,
  type Feder,
} from './rasterZoom'

// Ein fester Zufall, damit die Tests nicht wackeln.
function zufallsfolge(seed = 7) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

describe('rasterZoom', () => {
  it('4×4 auf dem iPhone: vier Spalten, vier Reihen auf einem Bildschirm', () => {
    const stufe = ZOOM_STUFEN[0]
    const mass = kachelMass(stufe, { breite: 366, hoehe: 680 })
    expect(stufe.spalten * mass.breite + (stufe.spalten - 1) * stufe.abstand).toBeLessThanOrEqual(366)
    expect(stufe.zeilen * mass.hoehe + (stufe.zeilen - 1) * stufe.abstand).toBeLessThanOrEqual(680)
    expect(mass.breite).toBeGreaterThan(80)
  })

  it('die zweite Stufe ist dichter als die erste', () => {
    const [nah, fern] = ZOOM_STUFEN
    expect(fern.spalten * fern.zeilen).toBeGreaterThan(nah.spalten * nah.zeilen)
  })

  it('jede Kachel bekommt eine Schwelle im Erscheinfenster, gleichmaessig verteilt', () => {
    const schwellen = erscheinSchwellen(16, zufallsfolge())
    expect(schwellen).toHaveLength(16)
    for (const s of schwellen) {
      expect(s).toBeGreaterThanOrEqual(ERSCHEINEN_AB)
      expect(s).toBeLessThanOrEqual(ERSCHEINEN_BIS)
    }
    // Keine Ballung: in jedem Viertel des Fensters liegen ein paar.
    const viertel = (ERSCHEINEN_BIS - ERSCHEINEN_AB) / 4
    for (let i = 0; i < 4; i++) {
      const drin = schwellen.filter(s => s >= ERSCHEINEN_AB + i * viertel && s < ERSCHEINEN_AB + (i + 1) * viertel + 1e-9)
      expect(drin.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('die Reihenfolge ist nicht die Rasterreihenfolge', () => {
    const schwellen = erscheinSchwellen(12, zufallsfolge(3))
    const sortiert = [...schwellen].sort((a, b) => a - b)
    expect(schwellen).not.toEqual(sortiert)
  })

  it('eine Kachel ist vor ihrer Schwelle unsichtbar und am Ende ganz da', () => {
    expect(kachelFortschritt(0.2, 0.3)).toBe(0)
    expect(kachelFortschritt(1, 0.62)).toBe(1)
    const mitte = kachelFortschritt(0.5, 0.3)
    expect(mitte).toBeGreaterThan(0)
    expect(mitte).toBeLessThan(1)
  })

  it('die Feder kommt an und ruht dann', () => {
    let zustand: Feder = { wert: 0, tempo: 0 }
    let zeit = 0
    while (!federRuht(zustand, 1) && zeit < 3) {
      zustand = federSchritt(zustand, 1, 1 / 60)
      zeit += 1 / 60
    }
    expect(federRuht(zustand, 1)).toBe(true)
    // Zuegig, aber nicht abrupt: zwischen einer viertel und einer ganzen Sekunde.
    expect(zeit).toBeGreaterThan(0.25)
    expect(zeit).toBeLessThan(1.2)
  })

  it('die Feder bleibt bei einem langen Bild stabil', () => {
    const zustand = federSchritt({ wert: 0, tempo: 0 }, 1, 2)
    expect(Number.isFinite(zustand.wert)).toBe(true)
    expect(zustand.wert).toBeLessThan(1.5)
  })

  it('der Flug startet genau auf dem Karussell-Kasten und endet im Raster', () => {
    const von = { x: 100, y: 200, breite: 240, hoehe: 340 }
    const nach = { x: 20, y: 60, breite: 80, hoehe: 113 }
    expect(flug(von, nach, 0)).toEqual({ dx: 80, dy: 140, skala: 3 })
    expect(flug(von, nach, 1)).toEqual({ dx: 0, dy: 0, skala: 1 })
  })
})
