import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  POWDER_ASPECT,
  POWDER_BODY,
  POWDER_BODY_PATH,
  POWDER_LID,
  POWDER_LID_PATH,
  POWDER_LABEL,
  POWDER_LID_RIBS,
  POWDER_LID_RIB_YS,
  POWDER_LID_TOP_BAND,
  POWDER_LABEL_BOX,
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
    expect(POWDER_BODY.y).toBeLessThanOrEqual(POWDER_LID.y + POWDER_LID.height)
    expect(POWDER_SEAM_OVERLAP).toBeGreaterThan(0)
  })

  it('zeichnet die Dose in Frontansicht, ohne Deckflaeche', () => {
    // Jede andere Buehnenform ist eine reine Frontansicht: das Vial hat ein
    // Rechteck als Deckel, die Ampulle nur Boden- und Buehnenlicht als
    // Ellipsen, und liquidGeometry haelt die Fluessigkeitsoberflaeche
    // ausdruecklich flach. Eine fruehere Fassung zeigte Deckel und Boden von
    // leicht oben — in sich stimmig, aber quer zur Familie.
    expect(POWDER_LID_PATH).not.toContain('A ')
    expect(POWDER_BODY_PATH).not.toContain('A ')
    // Die Riffelung beginnt und endet ueberall auf derselben Hoehe.
    expect(POWDER_LID_RIB_YS.top).toBeGreaterThan(POWDER_LID.y + POWDER_LID_TOP_BAND / 2)
    expect(POWDER_LID_RIB_YS.bottom).toBeLessThan(POWDER_LID.y + POWDER_LID.height)
  })

  it('verdichtet die Rillen trotzdem zu den Raendern hin', () => {
    // Das ist KEIN Aufsicht-Merkmal: es folgt aus der waagerechten Kruemmung
    // und gilt in der Frontansicht genauso. Die Rillen werden ueber den Winkel
    // um die Achse verteilt, nicht ueber den Abstand auf dem Bildschirm.
    const abstand = (i: number) => POWDER_LID_RIBS[i + 1].x - POWDER_LID_RIBS[i].x
    const mitte = Math.floor(POWDER_LID_RIBS.length / 2)
    expect(abstand(0)).toBeLessThan(abstand(mitte))
    expect(abstand(POWDER_LID_RIBS.length - 2)).toBeLessThan(abstand(mitte))
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

  it('haelt die Etikettkanten gerade', () => {
    // Die gewoelbten von vorher waren die Aufsicht in klein: ein waagerecht
    // umlaufendes Band woelbt sich nur, wenn man von oben auf die Dose sieht.
    expect(POWDER_LABEL_BOX.y).toBe(POWDER_LABEL.top)
    expect(POWDER_LABEL_BOX.height).toBe(POWDER_LABEL.bottom - POWDER_LABEL.top)
    expect(POWDER_LABEL_BOX.x).toBeGreaterThan(POWDER_BODY.x)
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
