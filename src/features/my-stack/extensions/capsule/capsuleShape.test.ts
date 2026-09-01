import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  CAPSULE_ASPECT, CAPSULE_CAP_PATH, CAPSULE_CAP_INNER_PATH, CAPSULE_SEAM_X,
  CAPSULE_SHELL_PATH, CAPSULE_SHELL_INNER_PATH, CAPSULE_SHELL_INNER_PATH_NORMALIZED, CAPSULE_SPEC,
} from './capsuleShape'

describe('capsuleShape', () => {
  it('schliesst alle vier Konturen, damit sie als Fuellung und Clip taugen', () => {
    for (const d of [CAPSULE_SHELL_PATH, CAPSULE_SHELL_INNER_PATH, CAPSULE_CAP_PATH, CAPSULE_CAP_INNER_PATH]) {
      expect(d.startsWith('M')).toBe(true)
      expect(d.trimEnd().endsWith('Z')).toBe(true)
    }
  })

  it('zeichnet den Grundkoerper durchgehend, nicht nur die rechte Haelfte', () => {
    // Ein an die Kappe anstossender Koerper zeigt seine harte Kante durch die
    // durchsichtige Huelle — deshalb muss er die volle Laenge haben.
    const xs = [...CAPSULE_SHELL_PATH.matchAll(/(?:^M|[LC])\s*(\d+(?:\.\d+)?)/g)].map(m => Number(m[1]))
    expect(Math.min(...xs)).toBeLessThan(CAPSULE_SEAM_X)
    expect(Math.max(...xs)).toBeGreaterThan(200)
  })

  it('legt die Naht dort, wo die Kappe endet', () => {
    expect(CAPSULE_CAP_PATH.startsWith(`M${CAPSULE_SEAM_X} `)).toBe(true)
  })

  it('liegt flach: breiter als hoch, Verhaeltnis rund 2,9 zu 1', () => {
    expect(CAPSULE_ASPECT).toBeCloseTo(84 / 240, 3)
    expect(1 / CAPSULE_ASPECT).toBeGreaterThan(2.5)
    expect(1 / CAPSULE_ASPECT).toBeLessThan(3.2)
  })

  it('beschreibt dieselbe Innenkontur in objektbezogenen Einheiten', () => {
    // Die HTML-Beschriftung kann nur so beschnitten werden; beide Fassungen
    // muessen zwingend dieselbe Form meinen.
    const abs = CAPSULE_SHELL_INNER_PATH.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
    const rel = CAPSULE_SHELL_INNER_PATH_NORMALIZED.match(/-?\d+(?:\.\d+)?/g)!.map(Number)

    expect(rel).toHaveLength(abs.length)
    abs.forEach((value, i) => {
      const expected = i % 2 === 0 ? value / 240 : value / 84
      expect(rel[i], `Koordinate ${i}`).toBeCloseTo(expected, 4)
    })
  })

  it('hat keine Fluessigkeitskammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(CAPSULE_SPEC.chamber).toBeNull()
    expect(CAPSULE_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(CAPSULE_SPEC)).toBe(false)
  })


})
