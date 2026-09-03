import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  PEN_ASPECT,
  PEN_BODY,
  PEN_DOSE_TEXT,
  PEN_DOSE_WINDOW,
  PEN_DOSE_WINDOW_PCT,
  PEN_KNOB,
  PEN_KNOB_PATH,
  PEN_KNOB_RIB_XS,
  PEN_KNOB_RIB_YS,
  PEN_KNOB_SHOULDER,
  PEN_NAME_BAND_PCT,
  PEN_NAME_RUN_PCT,
  PEN_NAME_TOP_PCT,
  PEN_NAME_ZONE,
  PEN_RING,
  PEN_SPEC,
  PEN_VIEWBOX,
} from './penShape'

describe('penShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(PEN_SPEC.viewBox).toEqual({ x: 0.5, y: 6, width: 39, height: 300 })
  })

  it('trifft die echten Proportionen eines Pens', () => {
    // 20 x 155 mm ergibt 0,129; die gezeichnete Form 39 : 300 = 0,130.
    expect(PEN_ASPECT).toBeCloseTo(PEN_VIEWBOX.width / PEN_VIEWBOX.height, 6)
    expect(PEN_ASPECT).toBeCloseTo(20 / 155, 2)
  })

  it('macht den Dosierknopf zur breitesten Stelle', () => {
    // Nicht der Koerper: der Knopf bestimmt Umriss und Seitenverhaeltnis.
    expect(PEN_KNOB.width).toBe(PEN_VIEWBOX.width)
    expect(PEN_KNOB.width).toBeGreaterThan(PEN_BODY.width)
  })

  it('weitet den Knopf konisch von der Koerperbreite auf', () => {
    // Die Schulter beginnt oben auf Koerperbreite und endet unten auf voller
    // Knopfbreite — eine Schraege statt einer Stufe.
    expect(PEN_KNOB_PATH).toContain(`M${PEN_BODY.x} ${PEN_KNOB_SHOULDER.y}`)
    expect(PEN_KNOB_PATH).toContain(`L${PEN_BODY.x + PEN_BODY.width} ${PEN_KNOB_SHOULDER.y}`)
    expect(PEN_KNOB_PATH).toContain(`L${PEN_KNOB.x + PEN_KNOB.width} ${PEN_KNOB_SHOULDER.flareY}`)
    expect(PEN_KNOB_SHOULDER.flareY).toBeGreaterThan(PEN_KNOB_SHOULDER.y)
  })

  it('laesst den Umriss unterhalb der Schulter unveraendert', () => {
    // Nur der Anschluss nach oben aendert sich; der abgerundete Knopf selbst
    // behaelt Breite, Fuss und Radius.
    const unten = PEN_KNOB.y + PEN_KNOB.height
    expect(PEN_KNOB_PATH).toContain(`L${PEN_KNOB.x + PEN_KNOB.width} ${unten - PEN_KNOB.rx}`)
    expect(PEN_KNOB_PATH).toContain(`L${PEN_KNOB.x + PEN_KNOB.rx} ${unten}`)
    expect(PEN_KNOB_PATH).toContain(`L${PEN_KNOB.x} ${PEN_KNOB_SHOULDER.flareY} Z`)
  })

  it('haelt die Rippen zwischen Schulter und Fussrundung', () => {
    // Vier schlichte Striche, unterhalb der Schraege beginnend und oberhalb
    // der Rundung endend.
    expect(PEN_KNOB_RIB_XS).toHaveLength(4)
    expect(PEN_KNOB_RIB_YS.top).toBeGreaterThanOrEqual(PEN_KNOB_SHOULDER.flareY)
    expect(PEN_KNOB_RIB_YS.bottom).toBeLessThan(PEN_KNOB.y + PEN_KNOB.height - PEN_KNOB.rx)
  })

  it('setzt den Farbring an den oberen Rand des Koerpers', () => {
    expect(PEN_RING.y).toBe(PEN_BODY.y)
    expect(PEN_RING.width).toBe(PEN_BODY.width)
    expect(PEN_RING.height).toBeLessThan(PEN_BODY.height / 8)
  })

  it('legt das Dosisfenster in den Koerper, nicht in den Knopf', () => {
    expect(PEN_DOSE_WINDOW.y).toBeGreaterThan(PEN_BODY.y)
    expect(PEN_DOSE_WINDOW.y + PEN_DOSE_WINDOW.height).toBeLessThan(PEN_KNOB.y)
    expect(PEN_DOSE_WINDOW.x).toBeGreaterThan(PEN_BODY.x)
    expect(PEN_DOSE_WINDOW.x + PEN_DOSE_WINDOW.width).toBeLessThan(PEN_BODY.x + PEN_BODY.width)
  })

  it('zeigt im Dosisfenster den Ruhezustand, keine erfundene Dosis', () => {
    expect(PEN_DOSE_TEXT).toBe('0')
  })

  it('rechnet das Dosisfenster in Prozent der viewBox um', () => {
    expect(PEN_DOSE_WINDOW_PCT.left).toBeCloseTo((PEN_DOSE_WINDOW.x - PEN_VIEWBOX.x) / PEN_VIEWBOX.width, 6)
    expect(PEN_DOSE_WINDOW_PCT.top).toBeCloseTo((PEN_DOSE_WINDOW.y - PEN_VIEWBOX.y) / PEN_VIEWBOX.height, 6)
  })

  it('setzt den Namen mittig ueber das Dosisfenster', () => {
    // Die Zone reicht von der Ringunterkante bis zur Fensteroberkante; der
    // Name sitzt in ihrer Mitte, das Fenster mit der 0 liegt darunter.
    expect(PEN_NAME_ZONE.top).toBe(PEN_RING.y + PEN_RING.height)
    expect(PEN_NAME_ZONE.bottom).toBe(PEN_DOSE_WINDOW.y)
    const mitte = (PEN_NAME_ZONE.top + PEN_NAME_ZONE.bottom) / 2
    expect(PEN_NAME_TOP_PCT).toBeCloseTo((mitte - PEN_VIEWBOX.y) / PEN_VIEWBOX.height, 6)
    // Und er reicht nicht bis ins Fenster hinein.
    const halbeLaufweite = (PEN_NAME_ZONE.bottom - PEN_NAME_ZONE.top) / 2
    expect(mitte + halbeLaufweite).toBeLessThanOrEqual(PEN_DOSE_WINDOW.y)
  })

  it('rechnet die gedrehte Huelle auf die jeweils passende Achse um', () => {
    // Die Huelle wird um 90 Grad gedreht: ihre Breite ist die Laufstrecke am
    // Koerper (eine Hoehe), ihre Hoehe die Koerperbreite (eine Breite). In CSS
    // loesen Prozente aber immer gegen die eigene Achse auf. Weil das
    // Seitenverhaeltnis fest ist, laesst sich das ineinander umrechnen — genau
    // das prueft dieser Test, indem er zurueckrechnet.
    expect(PEN_NAME_RUN_PCT * PEN_ASPECT).toBeCloseTo((PEN_NAME_ZONE.bottom - PEN_NAME_ZONE.top) / PEN_VIEWBOX.height, 6)
    expect(PEN_NAME_BAND_PCT / PEN_ASPECT).toBeCloseTo(PEN_BODY.width / PEN_VIEWBOX.width, 6)
  })

  it('gibt dem Namen laengs mehr Platz als jeder anderen Form quer', () => {
    // Ueber dem Fenster rund 71 px bei Karussellgroesse. Quer waeren es 28,
    // und die bisher grosszuegigste Form ist das Nasenspray mit 50,5 px.
    const laufstreckePx = ((PEN_NAME_ZONE.bottom - PEN_NAME_ZONE.top) / PEN_VIEWBOX.height) * 236.8
    expect(laufstreckePx).toBeGreaterThan(60)
  })

  it('hat keine Kammer und deshalb weder Etikett noch Fuellstand', () => {
    expect(PEN_SPEC.chamber).toBeNull()
    expect(carriesLabel(PEN_SPEC)).toBe(false)
    expect(PEN_SPEC.hasMeaningfulFill).toBe(false)
  })
})
