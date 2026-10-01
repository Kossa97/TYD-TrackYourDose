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
  seitenAufteilung,
  fortschrittHinein,
  fortschrittHinaus,
  zielBeimLoslassen,
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
  // Die Flaeche zwischen X oben und Reitern unten auf einem iPhone 13.
  const IPHONE = { breite: 366, hoehe: 620 }

  it.each([
    [1, 1, 1],
    [2, 1, 2],
    [4, 2, 2],
    [6, 2, 3],
    [9, 3, 3],
    [12, 3, 4],
    [16, 4, 4],
  ])('%i Substanzen teilen sich den Bildschirm als %i × %i', (anzahl, spalten, zeilen) => {
    const a = seitenAufteilung(anzahl, ZOOM_STUFEN[0], IPHONE)
    expect(a).toMatchObject({ spalten, zeilen, seiten: 1 })
    // Die Kacheln fuellen die Flaeche, statt oben zu kleben.
    expect(a.zeilen * a.kachelHoehe + (a.zeilen - 1) * ZOOM_STUFEN[0].abstand).toBeGreaterThan(IPHONE.hoehe - 8)
  })

  it('mehr als auf eine Seite passt, geht auf weitere Seiten', () => {
    expect(seitenAufteilung(17, ZOOM_STUFEN[0], IPHONE)).toMatchObject({ spalten: 4, zeilen: 4, proSeite: 16, seiten: 2 })
    expect(seitenAufteilung(40, ZOOM_STUFEN[0], IPHONE).seiten).toBe(3)
  })

  it('die zweite Stufe fasst mehr auf eine Seite', () => {
    const nah = seitenAufteilung(40, ZOOM_STUFEN[0], IPHONE)
    const fern = seitenAufteilung(40, ZOOM_STUFEN[1], IPHONE)
    expect(fern.proSeite).toBeGreaterThan(nah.proSeite)
    expect(fern.seiten).toBe(1)
  })

  it('ohne Substanzen: keine Seite, kein Fehler', () => {
    expect(seitenAufteilung(0, ZOOM_STUFEN[0], IPHONE).seiten).toBe(0)
  })

  it('die Geste: zusammen öffnet, auseinander schließt, Schwung entscheidet', () => {
    expect(fortschrittHinein(1)).toBe(0)
    expect(fortschrittHinein(0.5)).toBe(1)
    expect(fortschrittHinein(0.75)).toBeCloseTo(0.5)
    expect(fortschrittHinaus(1)).toBe(1)
    expect(fortschrittHinaus(1.8)).toBe(0)
    expect(zielBeimLoslassen(0.2, 0)).toBe(0)
    expect(zielBeimLoslassen(0.5, 0)).toBe(1)
    expect(zielBeimLoslassen(0.1, 3)).toBe(1)
    expect(zielBeimLoslassen(0.9, -3)).toBe(0)
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
