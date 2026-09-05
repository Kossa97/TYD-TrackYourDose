import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  POWDER_ASPECT,
  POWDER_BODY,
  POWDER_LID,
  POWDER_LID_RIB_XS,
  POWDER_LID_RIB_YS,
  POWDER_LID_RADIUS,
  POWDER_LID_TOP_BAND,
  POWDER_NAME_INSET_PCT,
  POWDER_NAME_TOP_PCT,
  POWDER_SEAM_OVERLAP,
  POWDER_SPEC,
  POWDER_VIEWBOX,
  POWDER_WIDTHS,
} from './powderShape'

describe('powderShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(POWDER_SPEC.viewBox).toEqual({ x: 10, y: 6, width: 100, height: 150 })
    // Eine stehende Dose: hoeher als breit, aber deutlich gedrungener als
    // jede Flasche. Das ist der Charakter, aus dem die Sprosse folgt.
    expect(POWDER_ASPECT).toBeLessThan(1)
    expect(POWDER_ASPECT).toBeGreaterThan(0.5)
  })

  it('laesst den Deckel ueber den Korpus stehen', () => {
    // Das ist der Unterschied zwischen „aufgeschraubt" und „oberes Drittel
    // andersfarbig": ohne Ueberstand liest sich die Trennlinie als Segment
    // derselben Dose.
    expect(POWDER_WIDTHS.lid).toBeGreaterThan(POWDER_WIDTHS.body)
    expect(POWDER_LID.width).toBe(POWDER_WIDTHS.lid)
    expect(POWDER_LID.x).toBeLessThan(POWDER_BODY.x)
  })

  it('laesst den Deckel die Korpusoberkante ueberdecken', () => {
    // Ein stumpfer Stoss zeigt je nach Skalierung eine Haarlinie. Der Korpus
    // wird zuerst gezeichnet, der Deckelrand deckt ihn ab.
    expect(POWDER_BODY.y).toBeLessThan(POWDER_LID.y + POWDER_LID.height)
    expect(POWDER_SEAM_OVERLAP).toBeGreaterThan(0)
  })

  it('haelt die Riffelung auf dem Deckelmantel', () => {
    // Nicht auf der flachen Oberseite und nicht auf der gebrochenen Kante.
    expect(POWDER_LID_RIB_YS.top).toBeGreaterThan(POWDER_LID.y + POWDER_LID_TOP_BAND)
    expect(POWDER_LID_RIB_YS.bottom).toBeLessThan(POWDER_LID.y + POWDER_LID.height)
    expect(Math.min(...POWDER_LID_RIB_XS)).toBeGreaterThan(POWDER_LID.x + POWDER_LID_RADIUS / 2)
    expect(Math.max(...POWDER_LID_RIB_XS)).toBeLessThan(POWDER_LID.x + POWDER_LID.width)
  })

  it('traegt weder Etikettband noch Fuellstand', () => {
    // Undurchsichtiges Pulver in einer undurchsichtigen Dose: ein Pegel waere
    // eine Behauptung. Wie Tube und Pflaster.
    expect(POWDER_SPEC.chamber).toBeNull()
    expect(POWDER_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(POWDER_SPEC)).toBe(false)
  })

  it('leitet den Namenseinzug aus dem Korpus her, statt ihn zu raten', () => {
    // Der Korpus ist schmaler als die viewBox, weil der Deckel uebersteht.
    // Bei der Tube war es die Verjuengung, hier der Deckelueberstand — beide
    // Male darf der Einzug keine geratene Zahl sein.
    const links = POWDER_VIEWBOX.x + POWDER_NAME_INSET_PCT * POWDER_VIEWBOX.width
    expect(links).toBeGreaterThan(POWDER_BODY.x)
    expect(links).toBeLessThan(POWDER_VIEWBOX.x + POWDER_VIEWBOX.width / 2)
    // Der Name steht unter dem Deckel, mittig im sichtbaren Korpus.
    const namensHoehe = POWDER_VIEWBOX.y + POWDER_NAME_TOP_PCT * POWDER_VIEWBOX.height
    expect(namensHoehe).toBeGreaterThan(POWDER_LID.y + POWDER_LID.height)
    expect(namensHoehe).toBeLessThan(POWDER_BODY.bottom)
  })
})
