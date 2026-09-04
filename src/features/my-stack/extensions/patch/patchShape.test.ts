import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  PATCH_ASPECT,
  PATCH_FLUTTER,
  PATCH_BODY,
  PATCH_DOTS,
  PATCH_DOT_R,
  PATCH_NAME_PCT,
  PATCH_NAME_ZONE,
  PATCH_PAD,
  PATCH_SPEC,
  PATCH_VIEWBOX,
} from './patchShape'

describe('patchShape', () => {
  it('ist ein Streifen mit echten Halbkreisen an den Enden', () => {
    // Radius gleich halbe Hoehe: sonst waeren es nur abgerundete Ecken.
    expect(PATCH_BODY.rx).toBe(PATCH_BODY.height / 2)
    expect(PATCH_ASPECT).toBeGreaterThan(3)
    expect(PATCH_VIEWBOX.width).toBeGreaterThan(PATCH_VIEWBOX.height)
  })

  it('setzt das Wundkissen mittig auf den Streifen', () => {
    expect(PATCH_PAD.x + PATCH_PAD.width / 2).toBe(PATCH_BODY.x + PATCH_BODY.width / 2)
    expect(PATCH_PAD.y + PATCH_PAD.height / 2).toBe(PATCH_BODY.y + PATCH_BODY.height / 2)
    // Und es bleibt zwischen den runden Enden.
    expect(PATCH_PAD.x).toBeGreaterThan(PATCH_BODY.rx)
    expect(PATCH_PAD.x + PATCH_PAD.width).toBeLessThan(PATCH_BODY.width - PATCH_BODY.rx)
  })

  it('haelt jedes Loch innerhalb des Umrisses und neben dem Kissen', () => {
    expect(PATCH_DOTS.length).toBeGreaterThan(20)
    const mitte = PATCH_BODY.height / 2
    for (const punkt of PATCH_DOTS) {
      const aufDemKissen =
        punkt.x > PATCH_PAD.x &&
        punkt.x < PATCH_PAD.x + PATCH_PAD.width &&
        punkt.y > PATCH_PAD.y &&
        punkt.y < PATCH_PAD.y + PATCH_PAD.height
      expect(aufDemKissen, `Loch ${punkt.x}/${punkt.y} liegt auf dem Kissen`).toBe(false)

      // In den Halbkreisen an den Enden zaehlt der Abstand zur Kappenmitte.
      if (punkt.x < PATCH_BODY.rx) {
        const abstand = Math.hypot(punkt.x - PATCH_BODY.rx, punkt.y - mitte)
        expect(abstand + PATCH_DOT_R, `Loch ${punkt.x}/${punkt.y} ragt links heraus`)
          .toBeLessThan(PATCH_BODY.rx)
      }
      if (punkt.x > PATCH_BODY.width - PATCH_BODY.rx) {
        const abstand = Math.hypot(punkt.x - (PATCH_BODY.width - PATCH_BODY.rx), punkt.y - mitte)
        expect(abstand + PATCH_DOT_R, `Loch ${punkt.x}/${punkt.y} ragt rechts heraus`)
          .toBeLessThan(PATCH_BODY.rx)
      }
    }
  })

  it('versetzt die Reihen gegeneinander', () => {
    // Genau untereinander saehe nach Raster aus, nicht nach Lochung.
    const reihen = [...new Set(PATCH_DOTS.map(p => p.y))].sort((a, b) => a - b)
    expect(reihen.length).toBeGreaterThan(2)
    const erste = PATCH_DOTS.filter(p => p.y === reihen[0]).map(p => p.x)
    const zweite = PATCH_DOTS.filter(p => p.y === reihen[1]).map(p => p.x)
    expect(erste[0]).not.toBe(zweite[0])
  })

  it('legt den Namen auf das Kissen', () => {
    expect(PATCH_NAME_ZONE.left).toBeGreaterThanOrEqual(PATCH_PAD.x)
    expect(PATCH_NAME_ZONE.right).toBeLessThanOrEqual(PATCH_PAD.x + PATCH_PAD.width)
    expect(PATCH_NAME_ZONE.top).toBeGreaterThanOrEqual(PATCH_PAD.y)
    expect(PATCH_NAME_ZONE.bottom).toBeLessThanOrEqual(PATCH_PAD.y + PATCH_PAD.height)
  })

  it('rechnet die Namenszone in Prozent der viewBox um', () => {
    expect(PATCH_NAME_PCT.left).toBeCloseTo(
      (PATCH_NAME_ZONE.left - PATCH_VIEWBOX.x) / PATCH_VIEWBOX.width,
      6,
    )
    expect(PATCH_NAME_PCT.left + PATCH_NAME_PCT.width).toBeLessThanOrEqual(1)
    expect(PATCH_NAME_PCT.top + PATCH_NAME_PCT.height).toBeLessThanOrEqual(1)
  })

  it('stimmt beide Federn schwingend und gegeneinander ab', () => {
    // Daempfungsgrad = daempfung / (2 * sqrt(steifigkeit)). Unter 1 heisst
    // schwingend statt kriechend — sonst gaebe es kein Flattern.
    const grad = (f: { steifigkeit: number; daempfung: number }) =>
      f.daempfung / (2 * Math.sqrt(f.steifigkeit))
    expect(grad(PATCH_FLUTTER.left)).toBeLessThan(1)
    expect(grad(PATCH_FLUTTER.right)).toBeLessThan(1)
    // Und die Eigenfrequenzen unterscheiden sich, sonst wackelten beide Enden
    // im Gleichtakt und es saehe nach einem Scharnier aus.
    expect(PATCH_FLUTTER.left.steifigkeit).not.toBe(PATCH_FLUTTER.right.steifigkeit)
  })

  it('hat keine Kammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(PATCH_SPEC.chamber).toBeNull()
    expect(carriesLabel(PATCH_SPEC)).toBe(false)
    expect(PATCH_SPEC.hasMeaningfulFill).toBe(false)
  })
})
