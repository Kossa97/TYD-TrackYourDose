import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  DROPS_ASPECT,
  DROPS_CHAMBER,
  DROPS_COLLAR,
  DROPS_FILL,
  DROPS_INNER_PATH,
  DROPS_LABEL,
  DROPS_OUTER_PATH,
  DROPS_SPEC,
  DROPS_VIEWBOX,
  DROPS_WALL,
} from './dropsShape'

describe('dropsShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(DROPS_SPEC.viewBox).toEqual({ x: 8, y: 18, width: 84, height: 264 })
    // Eine stehende Flasche: hoeher als breit.
    expect(DROPS_ASPECT).toBeLessThan(1)
  })

  it('haelt die Innenkontur ueberall innerhalb der Aussenkontur', () => {
    // Beide beginnen am Hals und enden am Boden; die Wandstaerke ist 5 % der
    // Koerperbreite, wie beim Vial und der Ampulle.
    expect(DROPS_WALL).toBeCloseTo(DROPS_VIEWBOX.width * 0.05, 1)
    expect(DROPS_OUTER_PATH.startsWith('M33 72')).toBe(true)
    expect(DROPS_INNER_PATH.startsWith('M37.2 76')).toBe(true)
  })

  it('legt die Kammer in den geraden Teil des Innenraums', () => {
    // Rechteckig, damit die Geometrie kein Breitenprofil fuer die Schulter
    // braucht — derselbe Kunstgriff wie bei Vial, Ampulle und Nasenspray.
    expect(DROPS_CHAMBER.aspect).toBeCloseTo(DROPS_CHAMBER.width / DROPS_CHAMBER.height, 6)
    // Sie beginnt unterhalb der Schulter und endet ueber dem Boden.
    expect(DROPS_CHAMBER.y).toBeGreaterThan(130)
    expect(DROPS_CHAMBER.y + DROPS_CHAMBER.height).toBeLessThanOrEqual(278)
  })

  it('zeigt einen festen Pegel und keine Prozentzahl', () => {
    // getVialFillPct liest vials_in_stock, ein vial-spezifisches Altfeld: die
    // App kennt den Stand einer angebrochenen Tropfflasche nicht.
    expect(DROPS_FILL).toBeGreaterThan(0)
    expect(DROPS_FILL).toBeLessThan(1)
    expect(DROPS_SPEC.hasMeaningfulFill).toBe(false)
  })

  it('traegt ein Etikett, weil es einen Behaelter mit Fluessigkeit gibt', () => {
    expect(DROPS_SPEC.chamber).not.toBeNull()
    expect(carriesLabel(DROPS_SPEC)).toBe(true)
  })

  it('setzt das Etikettband auf den geraden Teil des Koerpers', () => {
    const oben = DROPS_VIEWBOX.y + DROPS_LABEL.topPct * DROPS_VIEWBOX.height
    const unten = oben + DROPS_LABEL.heightPct * DROPS_VIEWBOX.height
    // Unterhalb der Schulter und oberhalb des Bodens.
    expect(oben).toBeGreaterThan(130)
    expect(unten).toBeLessThan(282)
  })

  it('setzt den Schraubkragen zwischen Ballon und Flaschenhals', () => {
    expect(DROPS_COLLAR.y).toBe(72)
    expect(DROPS_COLLAR.width).toBeLessThan(DROPS_VIEWBOX.width)
  })
})
