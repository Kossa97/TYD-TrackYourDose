import { describe, expect, it } from 'vitest'
import { objektSkala, OBJEKT_DECKUNG } from './objektSkala'

describe('objektSkala', () => {
  it('faellt auf 1 zurueck, wenn eine Masszahl fehlt oder ungueltig ist', () => {
    const gueltig = { hoehe: 100, breite: 40, platzHoehe: 300, platzBreite: 200 }
    expect(objektSkala({ ...gueltig, hoehe: 0 })).toBe(1)
    expect(objektSkala({ ...gueltig, breite: -1 })).toBe(1)
    expect(objektSkala({ ...gueltig, platzHoehe: 0 })).toBe(1)
    expect(objektSkala({ ...gueltig, platzBreite: 0 })).toBe(1)
  })

  it('laesst ein hohes, schmales Objekt (Pen) an der Hoehe scheitern', () => {
    // 600x80 in einer 300x200 grossen Flaeche: die Hoehe ist der Flaschenhals.
    const skala = objektSkala({ hoehe: 600, breite: 80, platzHoehe: 300, platzBreite: 200 })

    expect(skala * 600).toBeLessThanOrEqual(300)
    expect(skala * 80).toBeLessThanOrEqual(200)
    // Die Hoehe schoepft die Deckung aus, die Breite bleibt weit darunter.
    expect(skala * 600).toBeCloseTo(300 * OBJEKT_DECKUNG, 5)
  })

  it('laesst ein flaches, breites Objekt (liegende Kapsel) an der Breite scheitern', () => {
    // 100x280 in derselben Flaeche: jetzt begrenzt die Breite.
    const skala = objektSkala({ hoehe: 100, breite: 280, platzHoehe: 300, platzBreite: 200 })

    expect(skala * 100).toBeLessThanOrEqual(300)
    expect(skala * 280).toBeLessThanOrEqual(200)
    expect(skala * 280).toBeCloseTo(200 * OBJEKT_DECKUNG, 5)
  })

  it('behaelt das Seitenverhaeltnis: eine einzige Zahl skaliert beide Seiten gleich', () => {
    const masse = { hoehe: 120, breite: 60, platzHoehe: 400, platzBreite: 250 }
    const skala = objektSkala(masse)

    const nativesVerhaeltnis = masse.hoehe / masse.breite
    const skaliertesVerhaeltnis = (skala * masse.hoehe) / (skala * masse.breite)
    expect(skaliertesVerhaeltnis).toBeCloseTo(nativesVerhaeltnis, 10)
  })

  it('laesst etwas Luft zur Kante, statt die Flaeche randvoll zu fuellen', () => {
    // Ein Objekt, dessen Seitenverhaeltnis exakt dem der Flaeche entspricht:
    // ohne Deckung wuerde es beide Seiten exakt ausfuellen (Skala 0,5).
    const skala = objektSkala({ hoehe: 400, breite: 200, platzHoehe: 200, platzBreite: 100 })

    expect(skala).toBeCloseTo(0.5 * OBJEKT_DECKUNG, 10)
    expect(skala * 400).toBeLessThan(200)
    expect(skala * 200).toBeLessThan(100)
  })

  it('vergroessert nie — passt das Objekt schon hinein, bleibt es, wie es ist', () => {
    // Verkleinern ist verlustfrei, vergroessern nicht: die Buehnenformen bringen
    // feste Pixelwerte mit, die nicht die reine Form sind (Weichzeichnerradien,
    // Schattenversaetze, Schriftgroessen, Haarlinien). Ueber 1 werden die
    // mitgezogen und das Objekt sieht aus wie aufgeblasen statt wie gebaut.
    expect(objektSkala({ hoehe: 100, breite: 50, platzHoehe: 800, platzBreite: 600 })).toBe(1)

    // Auch dann, wenn nur eine Seite Platz haette.
    expect(objektSkala({ hoehe: 100, breite: 50, platzHoehe: 800, platzBreite: 52 })).toBeLessThan(1)
  })
})
