import { describe, expect, it } from 'vitest'
import { stepSlosh } from '../../../../components/sloshEngine'
import { GEL_TILT_RISE, GEL_TIME_CONSTANT, gelTiltDegrees, stepGelFlow } from './gelFlow'

const DT = 1 / 60

describe('gelFlow', () => {
  it('ueberschreitet sein Ziel nie, waehrend die Feder es tut', () => {
    // Der eigentliche Unterschied zwischen „schwappt" und „fliesst zaeh".
    // Dieselbe Anregung, zwei Charaktere: die unterdaempfte Feder der
    // Slosh-Maschine schwingt ueber die Ruhelage hinaus, das
    // Verzoegerungsglied kann das gar nicht.
    let feder = { angle: 0.8, vel: 0 }
    let federUeberschwang = false
    let gel = 0
    let gelUeberschwang = false

    for (let i = 0; i < 240; i += 1) {
      feder = stepSlosh(feder, DT)
      if (feder.angle < -0.02) federUeberschwang = true
      gel = stepGelFlow(gel, 0.8, DT)
      if (gel > 0.8) gelUeberschwang = true
    }

    expect(federUeberschwang).toBe(true)
    expect(gelUeberschwang).toBe(false)
  })

  it('laeuft der Bewegung hinterher statt ihr zu folgen', () => {
    // Nach einer Zeitkonstante sind 63 % des Weges zurueckgelegt, nicht mehr.
    let gel = 0
    const schritte = Math.round(GEL_TIME_CONSTANT / DT)
    for (let i = 0; i < schritte; i += 1) gel = stepGelFlow(gel, 1, DT)
    expect(gel).toBeGreaterThan(0.6)
    expect(gel).toBeLessThan(0.68)
  })

  it('haengt nicht an der Bildrate', () => {
    // Exponentielle Annaeherung statt linearer: eine Sekunde in 60 kleinen
    // Schritten landet dort, wo auch 20 grosse landen. Sonst floesse das Gel
    // auf einem schnellen Geraet anders als auf einem langsamen.
    let fein = 0
    for (let i = 0; i < 60; i += 1) fein = stepGelFlow(fein, 1, 1 / 60)
    let grob = 0
    for (let i = 0; i < 20; i += 1) grob = stepGelFlow(grob, 1, 1 / 20)
    expect(fein).toBeCloseTo(grob, 2)
  })

  it('kommt zur Ruhe, wenn die Anregung aufhoert', () => {
    let gel = 1
    for (let i = 0; i < 600; i += 1) gel = stepGelFlow(gel, 0, DT)
    expect(Math.abs(gel)).toBeLessThan(0.001)
  })

  it('bleibt bei unbrauchbarem Zeitschritt stehen', () => {
    expect(stepGelFlow(0.4, 1, 0)).toBe(0.4)
    expect(stepGelFlow(0.4, 1, -1)).toBe(0.4)
    expect(stepGelFlow(0.4, 1, Number.NaN)).toBe(0.4)
  })

  it('wirft die Masse weniger auf als Fluessigkeit', () => {
    // liquidGeometry nimmt 22 Einheiten Wandanstieg bei vollem Ausschlag.
    // Eine zaehe Masse laesst sich kaum aufwerfen.
    expect(GEL_TILT_RISE).toBeLessThan(22 / 3)
    // Und der Winkel folgt aus Anstieg und halber Kammerbreite, statt geraten
    // zu sein: bei 6 auf 62 sind das knapp 5,5 Grad.
    expect(gelTiltDegrees(GEL_TILT_RISE, 62)).toBeCloseTo(5.53, 1)
    expect(gelTiltDegrees(0, 62)).toBe(0)
  })
})
