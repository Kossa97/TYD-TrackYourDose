import { describe, expect, it } from 'vitest'
import { EINRASTEN_SCHWELLE_PX, mussEinrasten, zentrierPosition } from './carouselSettle'

describe('zentrierPosition', () => {
  it('holt einen Eintrag aus der Mitte des Streifens in die Mitte des Fensters', () => {
    // Eintrag 2 von 240 px Breite, Abstand 8, seitlicher Rand 81:
    // links = 81 + 2*248 = 577, Mitte = 697, Fenster 402 -> 697 - 201 = 496.
    expect(zentrierPosition({ itemLeft: 577, itemWidth: 240, clientWidth: 402, scrollWidth: 3000 }))
      .toBe(496)
  })

  it('klemmt am Anfang, wo der Platz zum Zentrieren fehlt', () => {
    // Der erste Eintrag liegt so weit links, dass seine Mitte nur mit
    // negativem Rollstand im Fenster mittig staende.
    expect(zentrierPosition({ itemLeft: 0, itemWidth: 240, clientWidth: 402, scrollWidth: 3000 }))
      .toBe(0)
  })

  it('klemmt am Ende auf den groessten moeglichen Rollstand', () => {
    expect(zentrierPosition({ itemLeft: 2700, itemWidth: 240, clientWidth: 402, scrollWidth: 3000 }))
      .toBe(2598)
  })

  it('kommt auch mit einem Streifen klar, der kuerzer ist als das Fenster', () => {
    expect(zentrierPosition({ itemLeft: 0, itemWidth: 240, clientWidth: 402, scrollWidth: 240 }))
      .toBe(0)
  })
})

describe('mussEinrasten', () => {
  it('faehrt nicht nach, was unter einem Bildpunkt liegt', () => {
    expect(mussEinrasten(496.4, 496)).toBe(false)
    expect(EINRASTEN_SCHWELLE_PX).toBe(1)
  })

  it('faehrt nach, sobald es sichtbar waere', () => {
    expect(mussEinrasten(463, 496)).toBe(true)
  })
})
