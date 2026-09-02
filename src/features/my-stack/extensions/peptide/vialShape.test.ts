import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  VIAL_INNER_PATH,
  VIAL_OUTER_PATH,
  VIAL_SPEC,
  VIAL_WALL,
} from './vialShape'

// Die Huelle wird in PeptideVialVisual gezeichnet; hier stehen die Daten, die
// Buehne und Fluessigkeit davon brauchen.
describe('vialShape', () => {
  it('laesst die Aussenkontur unveraendert', () => {
    // Die Silhouette des Vials ist gesetzt und wird von der Innenkontur nicht
    // angetastet — sie kommt hinzu, sie ersetzt nichts.
    expect(VIAL_OUTER_PATH).toBe('M28 0 L92 0 L92 24 C92 35 116 41 116 56 L116 252 C116 274 102 286 76 286 L44 286 C18 286 4 274 4 252 L4 56 C4 41 28 35 28 24 Z')
  })

  it('zieht die Innenkontur um die Wandstaerke nach innen', () => {
    const aussenLinks = 4
    const aussenRechts = 116
    const innenLinks = Number(VIAL_INNER_PATH.match(/L([\d.]+) 58/)![1])
    expect(innenLinks).toBeCloseTo(aussenLinks + VIAL_WALL, 6)
    expect(VIAL_INNER_PATH).toContain(`L${aussenRechts - VIAL_WALL} 250`)
  })

  it('gibt der Wand dieselbe anteilige Staerke wie die Ampulle', () => {
    // Ampulle: 3,4 von 68 Einheiten Koerperbreite. Ein fester Absolutwert
    // saehe auf dem fast doppelt so breiten Vial duenn aus.
    const koerperbreite = 116 - 4
    expect(VIAL_WALL / koerperbreite).toBeCloseTo(0.05, 4)
  })

  it('haelt die Kammer innerhalb der Innenkontur', () => {
    const chamber = VIAL_SPEC.chamber!
    expect(chamber.x).toBeGreaterThanOrEqual(4 + VIAL_WALL)
    expect(chamber.x + chamber.width).toBeLessThanOrEqual(116 - VIAL_WALL)
  })

  it('laesst einen Glasboden unter der Fluessigkeit', () => {
    // Sonst klebt die Fluessigkeit auf der Aussenwand — der Fehler, den die
    // Ampulle beim Bau hatte und den das Vial bis jetzt ebenfalls hatte.
    const chamber = VIAL_SPEC.chamber!
    const aussenBoden = 286
    expect(aussenBoden - (chamber.y + chamber.height)).toBeGreaterThanOrEqual(VIAL_WALL)
  })

  it('leitet das gerenderte Kammerverhaeltnis aus den Kammermassen ab', () => {
    // Das Vial wird mit preserveAspectRatio="none" in eine 80 x 112 grosse
    // Karussellkachel gezogen, deshalb ist das gerenderte Verhaeltnis nicht
    // width/height der viewBox-Einheiten.
    const chamber = VIAL_SPEC.chamber!
    const gerendert = (chamber.width / 120 * 80) / (chamber.height / 294 * 112)
    expect(chamber.aspect).toBeCloseTo(gerendert, 3)
  })

  it('bleibt ein Behaelter mit aussagekraeftigem Fuellstand', () => {
    expect(carriesLabel(VIAL_SPEC)).toBe(true)
    expect(VIAL_SPEC.hasMeaningfulFill).toBe(true)
  })
})
