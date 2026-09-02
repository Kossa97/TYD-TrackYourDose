import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  TUBE_ASPECT,
  TUBE_CAP,
  TUBE_CAP_RECESS,
  TUBE_CAP_SEAM_Y,
  TUBE_CRIMP,
  TUBE_LIGHT_CORE_SHIFT,
  TUBE_LIGHT_MAX_DEG,
  TUBE_NAME_INSET_PCT,
  TUBE_NAME_TOP_PCT,
  TUBE_SPEC,
  TUBE_TAPER,
} from './tubeShape'

describe('tubeShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(TUBE_SPEC.viewBox).toEqual({ x: 21, y: 6, width: 78, height: 279 })
  })

  it('leitet das Seitenverhaeltnis aus der viewBox ab', () => {
    expect(TUBE_ASPECT).toBeCloseTo(TUBE_SPEC.viewBox.width / TUBE_SPEC.viewBox.height, 6)
  })

  it('macht die Quetschnaht zur breitesten Stelle der Form', () => {
    // Kein aufgesetzter Deckel: die Naht ist der obere Abschluss desselben
    // Blechs, ihre Aussenecken sind die breitesten Punkte ueberhaupt.
    expect(TUBE_CRIMP.width).toBe(TUBE_SPEC.viewBox.width)
    expect(TUBE_CRIMP.x).toBe(TUBE_SPEC.viewBox.x)
  })

  it('verjuengt den Koerper von der Naht zum Deckel', () => {
    const oben = TUBE_TAPER.xTopRight - TUBE_TAPER.xTopLeft
    const unten = TUBE_TAPER.xBottomRight - TUBE_TAPER.xBottomLeft
    expect(unten).toBeLessThan(oben)
    expect(unten / oben).toBeGreaterThan(0.6)
  })

  it('setzt den Deckel schmaler als das Tubenende, damit eine Schulter entsteht', () => {
    expect(TUBE_CAP.width).toBeLessThan(TUBE_TAPER.xBottomRight - TUBE_TAPER.xBottomLeft)
  })

  it('laesst den Deckel flacher als breit sein', () => {
    expect(TUBE_CAP.height / TUBE_CAP.width).toBeLessThan(0.8)
  })

  it('laesst die Trennfuge durch die Daumenmulde laufen', () => {
    // Die Fuge ist die Oeffnung, die Mulde der Angriffspunkt — liegen sie
    // getrennt, wirken es zwei zusammenhanglose Details.
    const oben = TUBE_CAP_RECESS.cy - TUBE_CAP_RECESS.ry
    const unten = TUBE_CAP_RECESS.cy + TUBE_CAP_RECESS.ry
    expect(TUBE_CAP_SEAM_Y).toBeGreaterThan(oben)
    expect(TUBE_CAP_SEAM_Y).toBeLessThan(unten)
  })

  it('haelt die Mulde innerhalb des Deckels', () => {
    expect(TUBE_CAP_RECESS.cx - TUBE_CAP_RECESS.rx).toBeGreaterThan(TUBE_CAP.x)
    expect(TUBE_CAP_RECESS.cx + TUBE_CAP_RECESS.rx).toBeLessThan(TUBE_CAP.x + TUBE_CAP.width)
  })

  it('leitet den Namenseinzug aus der Verjuengung her', () => {
    // Unabhaengig nachgerechnet: auf Namenshoehe ist der Koerper schmaler als
    // die viewBox, also muss der Einzug groesser als null sein.
    const y = TUBE_SPEC.viewBox.y + TUBE_NAME_TOP_PCT * TUBE_SPEC.viewBox.height
    const t = (y - TUBE_TAPER.yTop) / (TUBE_TAPER.yBottom - TUBE_TAPER.yTop)
    const links = TUBE_TAPER.xTopLeft + (TUBE_TAPER.xBottomLeft - TUBE_TAPER.xTopLeft) * t
    expect(TUBE_NAME_INSET_PCT).toBeCloseTo((links - TUBE_SPEC.viewBox.x) / TUBE_SPEC.viewBox.width, 6)
  })

  it('braucht anders als das Nasenspray einen Einzug groesser als null', () => {
    // Dort lag der Koerper auf Etiketthoehe auf der vollen Breite, hier nicht.
    expect(TUBE_NAME_INSET_PCT).toBeGreaterThan(0.05)
    expect(TUBE_NAME_INSET_PCT).toBeLessThan(0.12)
  })

  it('haelt die Lichtdrehung in einem Bereich, der die Form nicht verdreht', () => {
    expect(TUBE_LIGHT_MAX_DEG).toBeGreaterThan(0)
    expect(TUBE_LIGHT_MAX_DEG).toBeLessThanOrEqual(45)
    expect(TUBE_LIGHT_CORE_SHIFT).toBeGreaterThan(0)
  })

  it('hat keine Kammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(TUBE_SPEC.chamber).toBeNull()
    expect(carriesLabel(TUBE_SPEC)).toBe(false)
    expect(TUBE_SPEC.hasMeaningfulFill).toBe(false)
  })
})
