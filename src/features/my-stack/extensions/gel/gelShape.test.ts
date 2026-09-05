import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import { POWDER_ASPECT } from '../powder/powderShape'
import { TUBE_ASPECT } from '../tube/tubeShape'
import {
  GEL_ASPECT,
  GEL_BODY,
  GEL_BODY_FILL_PATH,
  GEL_BODY_PATH,
  GEL_CAVITY,
  GEL_HEADROOM,
  GEL_INNER_TOP,
  GEL_LABEL,
  GEL_LABEL_BOX,
  GEL_LID,
  GEL_LID_PATH,
  GEL_NAME_TOP_PCT,
  GEL_SEAM_OVERLAP,
  GEL_SPEC,
  GEL_SURFACE,
  GEL_VIEWBOX,
  buildGelBodyPath,
  buildGelSurfacePath,
} from './gelShape'

describe('gelShape', () => {
  it('steht als einzige Form breiter als hoch', () => {
    // Das ist das Unterscheidungsmerkmal, nicht Geschmack: Gel hat zwei
    // Nachbarn, die dasselbe zeigen koennten. Die Tube deckt Gel heute mit ab,
    // und die Pulverdose ist ebenfalls ein Zylinder mit Schraubdeckel. Beide
    // stehen hochkant — schon die Silhouette schliesst die Verwechslung aus.
    expect(GEL_SPEC.viewBox).toEqual({ x: 5, y: 4, width: 150, height: 120 })
    expect(GEL_ASPECT).toBeGreaterThan(1)
    expect(POWDER_ASPECT).toBeLessThan(1)
    expect(TUBE_ASPECT).toBeLessThan(1)
  })

  it('zeichnet den Tiegel in Frontansicht, ohne Deckflaeche', () => {
    // Jede andere Buehnenform ist eine reine Frontansicht: das Vial hat ein
    // Rechteck als Deckel, die Ampulle nur Boden- und Buehnenlicht als
    // Ellipsen, und liquidGeometry haelt die Fluessigkeitsoberflaeche
    // ausdruecklich flach. Eine fruehere Fassung zeigte Deckel, Boden und
    // Geloberflaeche von leicht oben — in sich stimmig, aber quer zur Familie.
    expect(GEL_LID_PATH).not.toContain('A ')
    expect(GEL_BODY_PATH).not.toContain('A ')
    expect(GEL_BODY_FILL_PATH).not.toContain('A ')
  })

  it('traegt weder Etikettband noch Fuellstand', () => {
    // Gel ist keine Fluessigkeit: keine Kammer, damit weder Etikettband noch
    // Prozentzeile.
    expect(GEL_SPEC.chamber).toBeNull()
    expect(GEL_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(GEL_SPEC)).toBe(false)
  })

  it('laesst den Deckelrand die Glasoberkante ueberdecken', () => {
    expect(GEL_SEAM_OVERLAP).toBeGreaterThan(0)
    expect(GEL_BODY.y).toBeLessThan(GEL_LID.y + GEL_LID.height)
    // Und die Wandstaerke endet oben ebenfalls unter dem Deckel, damit ihr
    // waagerechter Ringschluss nicht frei im Glas steht.
    expect(GEL_INNER_TOP).toBeLessThan(GEL_LID.y + GEL_LID.height)
  })

  it('laesst Luft zwischen Deckel und Geloberflaeche', () => {
    // Ein bis zum Rand gefuellter Tiegel saehe aus wie ein Farbtopf.
    expect(GEL_HEADROOM).toBeGreaterThan(20)
    expect(GEL_SURFACE.cy).toBeGreaterThan(GEL_LID.y + GEL_LID.height)
  })

  it('woelbt die Geloberflaeche, statt sie flach zu halten', () => {
    // Gel nivelliert sich nicht. In der Frontansicht steht das in der Woelbung
    // der Linie: liquidGeometry haelt seine Oberflaeche ausdruecklich flach
    // ("real water is flat"), diese hebt sich in der Mitte.
    expect(GEL_SURFACE.bow).toBeGreaterThan(0)
    // Der Kontrollpunkt liegt doppelt so weit ueber der Mitte wie die
    // Woelbung: eine quadratische Bezier erreicht auf halbem Weg nur die
    // Haelfte des Abstands zu ihrem Kontrollpunkt.
    const steuer = (GEL_SURFACE.cy - 2 * GEL_SURFACE.bow).toFixed(2)
    expect(buildGelSurfacePath(0)).toContain(`Q 80 ${steuer}`)
  })

  it('kippt beim Neigen nur die Oberkante, nicht den Boden', () => {
    // Eine zaehe Masse verliert den Kontakt zur Wand nicht.
    const geneigt = buildGelBodyPath(6)
    expect(geneigt.startsWith('M14 48.00')).toBe(true)
    expect(geneigt).toContain('146 60.00')
    const boden = 'L146 113 C146 116.3 143.3 119 140 119 L20 119 C16.7 119 14 116.3 14 113 Z'
    expect(geneigt).toContain(boden)
    expect(buildGelBodyPath(0)).toContain(boden)
  })

  it('laesst die Masse oben und unten am Etikett vorbeischauen', () => {
    // Lag das Band zu tief, schnitt es die Masse unten ab, statt auf ihr zu
    // liegen — erst der Streifen darunter zeigt, dass der Tiegel hinter dem
    // Papier weitergeht.
    const obenSichtbar = GEL_LABEL.top - GEL_SURFACE.cy
    const untenSichtbar = GEL_CAVITY.bottom - GEL_LABEL.bottom
    expect(obenSichtbar).toBeGreaterThan(10)
    expect(untenSichtbar).toBeGreaterThan(10)
    // Und zwar etwa gleich viel, nicht ein Spalt gegen ein Fenster.
    expect(Math.abs(obenSichtbar - untenSichtbar)).toBeLessThan(5)
  })

  it('klebt das Etikett aussen auf, bis an die Silhouette', () => {
    // Mit Einzug spannte es nur ueber den Innenraum, und die beiden Streifen
    // Glas daneben liessen es hinter der Wand liegen statt darauf.
    expect(GEL_LABEL_BOX.x).toBe(GEL_BODY.x)
    expect(GEL_LABEL_BOX.width).toBe(GEL_BODY.right - GEL_BODY.x)
    const namensHoehe = GEL_VIEWBOX.y + GEL_NAME_TOP_PCT * GEL_VIEWBOX.height
    expect(namensHoehe).toBeGreaterThan(GEL_LABEL.top)
    expect(namensHoehe).toBeLessThan(GEL_LABEL.bottom)
  })
})
