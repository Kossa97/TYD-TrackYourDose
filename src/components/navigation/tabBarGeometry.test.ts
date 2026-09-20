import { describe, expect, it } from 'vitest'
import {
  PILLE_HOEHE, PILLE_LUFT, PILLE_MAX, freieLage, pillenBreite, platzBei,
} from './tabBarGeometry'

describe('pillenBreite', () => {
  it('lässt links und rechts Luft, damit die Pille das Fach nicht ausmalt', () => {
    // Auf einem 402 px breiten Schirm ist ein Platz rund 74 px breit.
    expect(pillenBreite(74)).toBe(74 - 2 * PILLE_LUFT)
  })

  it('wird nie schmaler als hoch — sonst liefe sie den Rundungen entgegen', () => {
    // Die Kapsel ist ein liegendes Oval. Eine stehende Pille darin sieht
    // daneben aus; im schlimmsten Fall ist sie kreisrund, nie hochkant.
    expect(pillenBreite(40)).toBe(PILLE_HOEHE)
    expect(pillenBreite(10)).toBe(PILLE_HOEHE)
  })

  it('wächst auf einem breiten Schirm nicht ins Plumpe', () => {
    expect(pillenBreite(200)).toBe(PILLE_MAX)
  })
})

describe('freieLage', () => {
  it('hängt die Pille mittig unter die Fingerspitze', () => {
    expect(freieLage(180, 46, 360)).toBe(180 - 23)
  })

  it('klemmt sie an den Rand, statt sie halb in der Luft hängen zu lassen', () => {
    expect(freieLage(0, 46, 360)).toBe(PILLE_LUFT / 2)
    expect(freieLage(360, 46, 360)).toBe(360 - PILLE_LUFT / 2 - 46)
  })
})

describe('platzBei', () => {
  const plaetze = [
    { id: 'home', mitte: 40 },
    { id: 'my-stack', mitte: 108 },
    { id: 'plus', mitte: 180 },
    { id: 'kalender', mitte: 248 },
    { id: 'profil', mitte: 316 },
  ]

  it('nimmt den nächstgelegenen, auch zwischen zwei Plätzen', () => {
    expect(platzBei(plaetze, 40)).toBe('home')
    expect(platzBei(plaetze, 100)).toBe('my-stack')
    // Genau dazwischen (144) liegt „my-stack" so nah wie „plus" — dann
    // gewinnt der frühere, weil ein strenges Kleiner nicht tauscht.
    expect(platzBei(plaetze, 144)).toBe('my-stack')
    expect(platzBei(plaetze, 145)).toBe('plus')
  })

  it('geht auch weit außerhalb nicht daneben', () => {
    expect(platzBei(plaetze, -500)).toBe('home')
    expect(platzBei(plaetze, 5000)).toBe('profil')
  })

  it('verträgt einen leeren Streifen', () => {
    expect(platzBei([], 100)).toBeNull()
  })
})
