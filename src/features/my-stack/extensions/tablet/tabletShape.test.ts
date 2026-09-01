import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  TABLET_BODY, TABLET_BODY_NORMALIZED, TABLET_NAME_TOP_PCT,
  TABLET_SCORE, TABLET_SPEC, TABLET_VIEWBOX,
} from './tabletShape'

describe('tabletShape', () => {
  it('ist quadratisch, damit der Kreis bei jeder Groesse rund bleibt', () => {
    expect(TABLET_VIEWBOX.width).toBe(TABLET_VIEWBOX.height)
  })

  it('fuellt den Kasten fast vollstaendig aus', () => {
    const diameter = TABLET_BODY.r * 2
    expect(diameter / TABLET_VIEWBOX.width).toBeGreaterThan(0.9)
    expect(diameter / TABLET_VIEWBOX.width).toBeLessThanOrEqual(1)
  })

  it('legt die Bruchrille waagerecht auf die Mittellinie', () => {
    expect(TABLET_SCORE.y).toBe(TABLET_BODY.cy)
    expect(TABLET_SCORE.x1).toBeLessThan(TABLET_SCORE.x2)
  })

  it('laesst die Rille ueber nahezu den ganzen Durchmesser laufen', () => {
    const span = TABLET_SCORE.x2 - TABLET_SCORE.x1
    expect(span / (TABLET_BODY.r * 2)).toBeGreaterThan(0.85)
  })

  it('setzt den Namen unter die Rille, nicht darauf', () => {
    const nameY = TABLET_NAME_TOP_PCT * TABLET_VIEWBOX.height
    expect(nameY).toBeGreaterThan(TABLET_SCORE.y)
    // und noch innerhalb des Kreises
    expect(nameY).toBeLessThan(TABLET_BODY.cy + TABLET_BODY.r)
  })

  it('beschreibt denselben Kreis in objektbezogenen Einheiten', () => {
    // Die HTML-Beschriftung kann nur so beschnitten werden; beide Fassungen
    // muessen zwingend denselben Kreis meinen.
    expect(TABLET_BODY_NORMALIZED.cx).toBeCloseTo(TABLET_BODY.cx / TABLET_VIEWBOX.width, 4)
    expect(TABLET_BODY_NORMALIZED.cy).toBeCloseTo(TABLET_BODY.cy / TABLET_VIEWBOX.height, 4)
    expect(TABLET_BODY_NORMALIZED.r).toBeCloseTo(TABLET_BODY.r / TABLET_VIEWBOX.width, 4)
  })

  it('hat keine Fluessigkeitskammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(TABLET_SPEC.chamber).toBeNull()
    expect(TABLET_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(TABLET_SPEC)).toBe(false)
  })
})
