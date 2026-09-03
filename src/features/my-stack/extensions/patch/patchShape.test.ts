import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  PATCH_ASPECT,
  PATCH_BODY,
  PATCH_BODY_PATH,
  PATCH_FLAP_PATH,
  PATCH_FLAP_TIP,
  PATCH_FOLD_A,
  PATCH_FOLD_B,
  PATCH_NAME_PCT,
  PATCH_NAME_ZONE,
  PATCH_SPEC,
  PATCH_STRIPE,
  PATCH_VIEWBOX,
} from './patchShape'

describe('patchShape', () => {
  it('liegt quer und bricht damit mit der Leiter der stehenden Formen', () => {
    expect(PATCH_ASPECT).toBeGreaterThan(1)
    expect(PATCH_VIEWBOX.width).toBeGreaterThan(PATCH_VIEWBOX.height)
  })

  it('spiegelt die abgehobene Ecke korrekt an der Falzlinie', () => {
    // Die Lasche ist das Spiegelbild der weggeklappten Ecke. Fuer ein
    // rechtwinklig-gleichschenkliges Dreieck ist das A + B - C.
    const ecke = { x: PATCH_BODY.x + PATCH_BODY.width, y: PATCH_BODY.y }
    expect(PATCH_FLAP_TIP.x).toBe(PATCH_FOLD_A.x + PATCH_FOLD_B.x - ecke.x)
    expect(PATCH_FLAP_TIP.y).toBe(PATCH_FOLD_A.y + PATCH_FOLD_B.y - ecke.y)
    // Und sie liegt auf dem Pflaster, nicht daneben.
    expect(PATCH_FLAP_TIP.x).toBeGreaterThan(PATCH_BODY.x)
    expect(PATCH_FLAP_TIP.y).toBeLessThan(PATCH_BODY.y + PATCH_BODY.height)
  })

  it('faehrt der Koerperumriss die Falzlinie statt der Ecke ab', () => {
    // Die Ecke fehlt dem Koerper — sonst laege die Lasche auf vollem Material.
    expect(PATCH_BODY_PATH).toContain(`L${PATCH_FOLD_A.x} ${PATCH_FOLD_A.y}`)
    expect(PATCH_BODY_PATH).toContain(`L${PATCH_FOLD_B.x} ${PATCH_FOLD_B.y}`)
    expect(PATCH_FLAP_PATH).toContain(`M${PATCH_FOLD_A.x} ${PATCH_FOLD_A.y}`)
  })

  it('haelt den Namen frei von Falz und Farbstreifen', () => {
    expect(PATCH_NAME_ZONE.top).toBeGreaterThan(PATCH_FOLD_B.y)
    expect(PATCH_NAME_ZONE.bottom).toBeLessThan(PATCH_STRIPE.y)
    expect(PATCH_NAME_ZONE.left).toBeGreaterThan(PATCH_BODY.x)
    expect(PATCH_NAME_ZONE.right).toBeLessThan(PATCH_BODY.x + PATCH_BODY.width)
  })

  it('rechnet die Namenszone in Prozent der viewBox um', () => {
    expect(PATCH_NAME_PCT.left).toBeCloseTo(
      (PATCH_NAME_ZONE.left - PATCH_VIEWBOX.x) / PATCH_VIEWBOX.width,
      6,
    )
    expect(PATCH_NAME_PCT.width).toBeCloseTo(
      (PATCH_NAME_ZONE.right - PATCH_NAME_ZONE.left) / PATCH_VIEWBOX.width,
      6,
    )
    // Alle vier Werte bleiben innerhalb der Zeichenflaeche.
    expect(PATCH_NAME_PCT.left + PATCH_NAME_PCT.width).toBeLessThanOrEqual(1)
    expect(PATCH_NAME_PCT.top + PATCH_NAME_PCT.height).toBeLessThanOrEqual(1)
  })

  it('legt den Farbstreifen an den unteren Rand', () => {
    expect(PATCH_STRIPE.y + PATCH_STRIPE.height).toBe(PATCH_BODY.y + PATCH_BODY.height)
  })

  it('hat keine Kammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(PATCH_SPEC.chamber).toBeNull()
    expect(carriesLabel(PATCH_SPEC)).toBe(false)
    expect(PATCH_SPEC.hasMeaningfulFill).toBe(false)
  })
})
