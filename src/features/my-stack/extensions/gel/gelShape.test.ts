import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import { POWDER_ASPECT } from '../powder/powderShape'
import { TUBE_ASPECT } from '../tube/tubeShape'
import {
  GEL_ASPECT,
  GEL_BODY,
  GEL_DOME,
  GEL_HEADROOM,
  GEL_INNER_BASE,
  GEL_INNER_TOP,
  GEL_LABEL,
  GEL_LABEL_PATH,
  GEL_LID_BOTTOM_Y,
  GEL_LID_RIM,
  GEL_NAME_TOP_PCT,
  GEL_SEAM_OVERLAP,
  GEL_SPEC,
  GEL_SURFACE,
  GEL_VIEWBOX,
} from './gelShape'

describe('gelShape', () => {
  it('steht als einzige Form breiter als hoch', () => {
    // Das ist das Unterscheidungsmerkmal, nicht Geschmack: Gel hat zwei
    // Nachbarn, die dasselbe zeigen koennten. Die Tube deckt Gel heute mit ab,
    // und die Pulverdose ist seit heute ebenfalls ein Zylinder mit
    // Schraubdeckel. Beide stehen hochkant — schon die Silhouette schliesst
    // die Verwechslung aus.
    expect(GEL_SPEC.viewBox).toEqual({ x: 5, y: 4, width: 150, height: 120 })
    expect(GEL_ASPECT).toBeGreaterThan(1)
    expect(POWDER_ASPECT).toBeLessThan(1)
    expect(TUBE_ASPECT).toBeLessThan(1)
  })

  it('traegt weder Etikettband noch Fuellstand', () => {
    // Gel ist keine Fluessigkeit: keine Kammer, damit weder Etikettband noch
    // Prozentzeile noch Schwappen.
    expect(GEL_SPEC.chamber).toBeNull()
    expect(GEL_SPEC.hasMeaningfulFill).toBe(false)
    expect(carriesLabel(GEL_SPEC)).toBe(false)
  })

  it('laesst den Deckelrand die Glasoberkante ueberdecken', () => {
    expect(GEL_SEAM_OVERLAP).toBeGreaterThan(0)
    expect(GEL_BODY.y).toBeLessThan(GEL_LID_BOTTOM_Y + GEL_LID_RIM.ry)
  })

  it('haelt die Wandstaerke oben unter dem Deckelbogen', () => {
    // Der vordere Bogen des Deckelrandes haengt an den Raendern am hoechsten:
    // dort entscheidet sich, ob der waagerechte Ringschluss der Innenkontur
    // sichtbar wird oder nicht. Bei y=35 stand er frei im Glas und las sich
    // als aufgemaltes Rechteck.
    const t = (GEL_BODY.x + 5 - GEL_LID_RIM.cx) / GEL_LID_RIM.rx
    const bogenAmRand = GEL_LID_BOTTOM_Y + GEL_LID_RIM.ry * Math.sqrt(1 - t * t)
    expect(GEL_INNER_TOP).toBeLessThan(bogenAmRand)
  })

  it('laesst Luft zwischen Deckel und Geloberflaeche', () => {
    // Ein bis zum Rand gefuellter Tiegel saehe aus wie ein Farbtopf.
    expect(GEL_HEADROOM).toBeGreaterThan(20)
    expect(GEL_SURFACE.cy).toBeGreaterThan(GEL_LID_BOTTOM_Y)
  })

  it('woelbt die Geloberflaeche, statt sie zu spiegeln', () => {
    // Gel nivelliert sich nicht. Die Woelbung ist eine zweite, kleinere
    // Ellipse ueber der ersten — eine flache Ellipse allein liest sich als
    // Fluessigkeitsspiegel, und genau das ist Gel nicht.
    expect(GEL_DOME.cy).toBeLessThan(GEL_SURFACE.cy)
    expect(GEL_DOME.rx).toBeLessThan(GEL_SURFACE.rx)
    expect(GEL_DOME.ry).toBeLessThan(GEL_SURFACE.ry)
  })

  it('laesst die Masse oben und unten am Etikett vorbeischauen', () => {
    // Gemessen an der Mittellinie, wo das Auge sie liest: von der Oberflaeche
    // bis zum Boden, beide als vorderer Bogen. Lag das Band zu tief, schnitt
    // es die Masse unten ab, statt auf ihr zu liegen — erst der Streifen
    // darunter zeigt, dass der Tiegel hinter dem Papier weitergeht.
    const obenSichtbar = GEL_LABEL.top - (GEL_SURFACE.cy + GEL_SURFACE.ry)
    const untenSichtbar = (GEL_INNER_BASE.cy + GEL_INNER_BASE.ry) - GEL_LABEL.bottom
    expect(obenSichtbar).toBeGreaterThan(10)
    expect(untenSichtbar).toBeGreaterThan(10)
    // Und zwar etwa gleich viel, nicht ein Spalt gegen ein Fenster.
    expect(Math.abs(obenSichtbar - untenSichtbar)).toBeLessThan(5)
    expect(GEL_LABEL.bottom).toBeLessThan(GEL_BODY.bottom)
    // Und seine Kanten sind Boegen wie alle waagerechten Kanten dieser Form,
    // mit dem Radius des KOERPERS: es klebt aussen auf dem Glas und laeuft bis
    // an die Silhouette, statt vor ihr aufzuhoeren.
    expect(GEL_LABEL_PATH).toContain(`A 67 ${GEL_LABEL.ry}`)
    expect(GEL_LABEL_PATH.startsWith(`M${GEL_BODY.x} ${GEL_LABEL.top}`)).toBe(true)
    const namensHoehe = GEL_VIEWBOX.y + GEL_NAME_TOP_PCT * GEL_VIEWBOX.height
    expect(namensHoehe).toBeGreaterThan(GEL_LABEL.top)
    expect(namensHoehe).toBeLessThan(GEL_LABEL.bottom)
  })
})
