import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  POWDER_ASPECT,
  POWDER_BODY,
  POWDER_LID,
  POWDER_LABEL,
  POWDER_LID_BOTTOM_Y,
  POWDER_LID_RIBS,
  POWDER_LID_RIM,
  POWDER_LABEL_PATH,
  POWDER_NAME_INSET_PCT,
  POWDER_NAME_TOP_PCT,
  POWDER_SEAM_OVERLAP,
  POWDER_SPEC,
  POWDER_VIEWBOX,
  POWDER_WIDTHS,
} from './powderShape'

describe('powderShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(POWDER_SPEC.viewBox).toEqual({ x: 10, y: 6, width: 100, height: 156 })
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

  it('setzt jede Rille auf den vorderen Bogen des Deckelrandes', () => {
    // Der Kern der Sache: der Rand eines Zylinders ist von leicht oben eine
    // Ellipse. Rillen, die alle auf derselben Hoehe beginnen, sind an einer
    // geraden Kante abgeschnitten — die Kappe liest sich dann flach.
    const mitte = POWDER_LID_RIBS.find(r => Math.abs(r.x - POWDER_LID_RIM.cx) < 3)!
    const aussen = POWDER_LID_RIBS[0]
    expect(mitte.yTop).toBeGreaterThan(aussen.yTop)
    // Und jede sitzt wirklich auf der Ellipse, nicht ungefaehr daneben.
    for (const rib of POWDER_LID_RIBS) {
      const t = (rib.x - POWDER_LID_RIM.cx) / POWDER_LID_RIM.rx
      const erwartet = POWDER_LID_RIM.cy + POWDER_LID_RIM.ry * Math.sqrt(1 - t * t)
      expect(rib.yTop).toBeCloseTo(erwartet, 1)
      // Alle Rillen sind gleich lang: der Mantel hat ueberall dieselbe Hoehe.
      expect(rib.yBottom - rib.yTop).toBeCloseTo(POWDER_LID_BOTTOM_Y - POWDER_LID_RIM.cy, 1)
    }
  })

  it('verdichtet die Rillen zu den Raendern hin', () => {
    // Sie werden ueber den Winkel um die Achse verteilt, nicht ueber den
    // Abstand auf dem Bildschirm. Deshalb ruecken sie am Rand von selbst
    // zusammen, wie es die Verkuerzung verlangt.
    const abstand = (i: number) => POWDER_LID_RIBS[i + 1].x - POWDER_LID_RIBS[i].x
    const mitte = Math.floor(POWDER_LID_RIBS.length / 2)
    expect(abstand(0)).toBeLessThan(abstand(mitte))
    expect(abstand(POWDER_LID_RIBS.length - 2)).toBeLessThan(abstand(mitte))
    // Und keine faellt aus dem Deckel heraus.
    expect(Math.min(...POWDER_LID_RIBS.map(r => r.x))).toBeGreaterThan(POWDER_LID.x)
    expect(Math.max(...POWDER_LID_RIBS.map(r => r.x))).toBeLessThan(POWDER_LID.x + POWDER_LID.width)
  })

  it('beleuchtet die Rillen einzeln statt alle gleich', () => {
    // Die Lampe steht links oben. Zu den Raendern hin dreht sich die Flaeche
    // weg: die Kerbe wird dort tiefer, die helle Kante verschwindet.
    const links = POWDER_LID_RIBS[2]
    const mitte = POWDER_LID_RIBS[Math.floor(POWDER_LID_RIBS.length / 2)]
    const rechts = POWDER_LID_RIBS[POWDER_LID_RIBS.length - 3]
    expect(links.groove).toBeGreaterThan(mitte.groove)
    expect(rechts.groove).toBeGreaterThan(mitte.groove)
    expect(links.highlight).toBeGreaterThan(rechts.highlight)
  })

  it('woelbt die Etikettkanten wie den Deckelrand', () => {
    // Ein waagerecht umlaufendes Band ist auf einem Zylinder unter Augenhoehe
    // kein gerader Strich. Ohne die beiden Boegen klebte ein flaches Rechteck
    // auf einer runden Dose.
    expect(POWDER_LABEL_PATH).toContain(`A ${(POWDER_WIDTHS.body - 2 * POWDER_LABEL.inset) / 2} ${POWDER_LABEL.ry}`)
    expect(POWDER_LABEL.top).toBeGreaterThan(POWDER_LID_BOTTOM_Y)
    expect(POWDER_LABEL.bottom).toBeLessThan(POWDER_BODY.bottom)
  })

  it('traegt weder Etikettband noch Fuellstand', () => {
    // Undurchsichtiges Pulver in einer undurchsichtigen Dose: ein Pegel waere
    // eine Behauptung. Wie Tube und Pflaster.
    expect(POWDER_SPEC.chamber).toBeNull()
    expect(POWDER_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(POWDER_SPEC)).toBe(false)
  })

  it('leitet den Namenseinzug aus dem Korpus her, statt ihn zu raten', () => {
    // Der Einzug ist der Rand des Etiketts, nicht der des Korpus. Bei der
    // Tube war es die Verjuengung — beide Male darf er keine geratene Zahl
    // sein.
    const links = POWDER_VIEWBOX.x + POWDER_NAME_INSET_PCT * POWDER_VIEWBOX.width
    expect(links).toBeGreaterThan(POWDER_BODY.x + POWDER_LABEL.inset)
    expect(links).toBeLessThan(POWDER_VIEWBOX.x + POWDER_VIEWBOX.width / 2)
    // Der Name sitzt in der Mitte des Etiketts, nicht der ganzen Form.
    const namensHoehe = POWDER_VIEWBOX.y + POWDER_NAME_TOP_PCT * POWDER_VIEWBOX.height
    expect(namensHoehe).toBeGreaterThan(POWDER_LABEL.top)
    expect(namensHoehe).toBeLessThan(POWDER_LABEL.bottom)
  })
})
