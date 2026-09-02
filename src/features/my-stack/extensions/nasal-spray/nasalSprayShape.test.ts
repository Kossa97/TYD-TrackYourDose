import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  NASAL_SPRAY_ASPECT,
  NASAL_SPRAY_BODY_INNER_PATH,
  NASAL_SPRAY_BODY_PATH,
  NASAL_SPRAY_COLLAR,
  NASAL_SPRAY_FILL,
  NASAL_SPRAY_FLANGE,
  NASAL_SPRAY_LABEL,
  NASAL_SPRAY_NOZZLE_PATH,
  NASAL_SPRAY_SPEC,
} from './nasalSprayShape'

describe('nasalSprayShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    // Sonst bemisst die Groessenklasse das Zeichenraster statt die Form, und
    // die Flasche verfehlt die gemeinsame Bodenlinie.
    expect(NASAL_SPRAY_SPEC.viewBox).toEqual({ x: 21, y: 6, width: 78, height: 288 })
  })

  it('leitet das Seitenverhaeltnis aus der viewBox ab', () => {
    expect(NASAL_SPRAY_ASPECT).toBeCloseTo(
      NASAL_SPRAY_SPEC.viewBox.width / NASAL_SPRAY_SPEC.viewBox.height,
      6,
    )
  })

  it('laesst Fingerauflage und Schraubkragen ohne Luecke aneinanderstossen', () => {
    // Eine Luecke zeigte sich bei `large` als heller Spalt quer durch den Kopf.
    expect(NASAL_SPRAY_FLANGE.y + NASAL_SPRAY_FLANGE.height).toBeCloseTo(NASAL_SPRAY_COLLAR.y, 6)
  })

  it('haelt die Fingerauflage innerhalb der Glasbreite', () => {
    // Ragt sie ueber den Flaschenrand, sitzt der Kopf wie ein Pilz auf.
    const glassLeft = NASAL_SPRAY_SPEC.viewBox.x
    const glassRight = NASAL_SPRAY_SPEC.viewBox.x + NASAL_SPRAY_SPEC.viewBox.width
    expect(NASAL_SPRAY_FLANGE.x).toBeGreaterThanOrEqual(glassLeft)
    expect(NASAL_SPRAY_FLANGE.x + NASAL_SPRAY_FLANGE.width).toBeLessThanOrEqual(glassRight)
  })

  it('staffelt den Kopf von der Duese ueber die Auflage zum Kragen', () => {
    // Von oben nach unten wird jedes Teil breiter, ausser der Auflage, die
    // bewusst ueber den Kragen hinausragt — daran greifen zwei Finger an.
    expect(NASAL_SPRAY_COLLAR.width).toBeLessThan(NASAL_SPRAY_FLANGE.width)
    expect(NASAL_SPRAY_COLLAR.y).toBeGreaterThan(NASAL_SPRAY_FLANGE.y)
  })

  it('gibt der Kopfgruppe knapp die Haelfte der Hoehe', () => {
    const total = NASAL_SPRAY_SPEC.viewBox.height
    const headEnd = NASAL_SPRAY_COLLAR.y + NASAL_SPRAY_COLLAR.height
    const headShare = (headEnd - NASAL_SPRAY_SPEC.viewBox.y) / total
    expect(headShare).toBeGreaterThan(0.44)
    expect(headShare).toBeLessThan(0.5)
  })

  it('legt die Kammer in den geraden Teil des Glases', () => {
    const chamber = NASAL_SPRAY_SPEC.chamber
    expect(chamber).not.toBeNull()
    // unterhalb des Kragens, also im Flaschenkoerper
    expect(chamber!.y).toBeGreaterThan(NASAL_SPRAY_COLLAR.y + NASAL_SPRAY_COLLAR.height)
    // und innerhalb der Glasaussenkante
    expect(chamber!.x).toBeGreaterThan(NASAL_SPRAY_SPEC.viewBox.x)
    expect(chamber!.x + chamber!.width).toBeLessThan(
      NASAL_SPRAY_SPEC.viewBox.x + NASAL_SPRAY_SPEC.viewBox.width,
    )
  })

  it('leitet das Kammerverhaeltnis aus den Kammermassen ab', () => {
    const chamber = NASAL_SPRAY_SPEC.chamber!
    expect(chamber.aspect).toBeCloseTo(chamber.width / chamber.height, 3)
  })

  it('laesst Kopfraum ueber der Fluessigkeit', () => {
    // Ohne Kopfraum hat die Oberflaeche keinen Platz zum Schwappen.
    expect(NASAL_SPRAY_FILL).toBeGreaterThan(0.8)
    expect(NASAL_SPRAY_FILL).toBeLessThan(1)
  })

  it('setzt das Etikettband auf den Flaschenkoerper', () => {
    const top = NASAL_SPRAY_SPEC.viewBox.y + NASAL_SPRAY_LABEL.topPct * NASAL_SPRAY_SPEC.viewBox.height
    const bottom = top + NASAL_SPRAY_LABEL.heightPct * NASAL_SPRAY_SPEC.viewBox.height
    const chamber = NASAL_SPRAY_SPEC.chamber!
    expect(top).toBeGreaterThan(chamber.y)
    expect(bottom).toBeLessThan(chamber.y + chamber.height)
  })

  it('zieht die Innenkontur ueberall innerhalb der Aussenkontur', () => {
    // Grobpruefung ueber die erste Koordinate: die Innenwand beginnt weiter
    // rechts als die Aussenwand, sonst gaebe es keine Wandstaerke.
    const outerX = Number(NASAL_SPRAY_BODY_PATH.match(/^M([\d.]+)/)![1])
    const innerX = Number(NASAL_SPRAY_BODY_INNER_PATH.match(/^M([\d.]+)/)![1])
    expect(innerX).toBeGreaterThan(outerX)
  })

  it('zeichnet die Duese als geschlossenen Pfad', () => {
    expect(NASAL_SPRAY_NOZZLE_PATH.trim().endsWith('Z')).toBe(true)
  })

  it('traegt ein Etikett, aber keinen aussagekraeftigen Fuellstand', () => {
    expect(carriesLabel(NASAL_SPRAY_SPEC)).toBe(true)
    expect(NASAL_SPRAY_SPEC.hasMeaningfulFill).toBe(false)
  })
})
