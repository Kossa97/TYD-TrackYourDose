import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import {
  DROPS_ASPECT,
  DROPS_CHAMBER,
  DROPS_CAP,
  DROPS_CAP_DOME,
  DROPS_CAP_PATH,
  DROPS_CAP_RIB_YS,
  DROPS_CAP_WAIST,
  DROPS_WIDTHS,
  DROPS_PIPETTE_OVERLAP,
  DROPS_PIPETTE_TOP,
  DROPS_FILL,
  DROPS_INNER_PATH,
  DROPS_INNER_STROKE_PATH,
  DROPS_INNER_STROKE_TOP,
  DROPS_LABEL,
  DROPS_LABEL_TOP,
  DROPS_OUTER_PATH,
  DROPS_SURFACE_Y,
  DROPS_SPEC,
  DROPS_VIEWBOX,
  DROPS_WALL,
} from './dropsShape'

describe('dropsShape', () => {
  it('beschneidet die viewBox auf die Objektgrenzen', () => {
    expect(DROPS_SPEC.viewBox).toEqual({ x: 14, y: 16, width: 72, height: 272 })
    // Eine stehende Flasche: hoeher als breit.
    expect(DROPS_ASPECT).toBeLessThan(1)
  })

  it('haelt die Innenkontur ueberall innerhalb der Aussenkontur', () => {
    // Beide beginnen am Hals und enden am Boden; die Wandstaerke ist 5 % der
    // Koerperbreite, wie beim Vial und der Ampulle.
    expect(DROPS_WALL).toBeCloseTo(DROPS_WIDTHS.body * 0.05, 1)
    expect(DROPS_OUTER_PATH.startsWith('M38 112')).toBe(true)
    expect(DROPS_INNER_PATH.startsWith('M41.6 116')).toBe(true)
  })

  it('legt die Kammer in den geraden Teil des Innenraums', () => {
    // Rechteckig, damit die Geometrie kein Breitenprofil fuer die Schulter
    // braucht — derselbe Kunstgriff wie bei Vial, Ampulle und Nasenspray.
    expect(DROPS_CHAMBER.aspect).toBeCloseTo(DROPS_CHAMBER.width / DROPS_CHAMBER.height, 6)
    // Sie beginnt unterhalb der Schulter und endet ueber dem Boden.
    expect(DROPS_CHAMBER.y).toBeGreaterThan(154)
    expect(DROPS_CHAMBER.y + DROPS_CHAMBER.height).toBeLessThanOrEqual(284.4)
  })

  it('zeigt einen festen Pegel und keine Prozentzahl', () => {
    // getVialFillPct liest vials_in_stock, ein vial-spezifisches Altfeld: die
    // App kennt den Stand einer angebrochenen Tropfflasche nicht.
    expect(DROPS_FILL).toBeGreaterThan(0)
    expect(DROPS_FILL).toBeLessThan(1)
    expect(DROPS_SPEC.hasMeaningfulFill).toBe(false)
  })

  it('traegt ein Etikett, weil es einen Behaelter mit Fluessigkeit gibt', () => {
    expect(DROPS_SPEC.chamber).not.toBeNull()
    expect(carriesLabel(DROPS_SPEC)).toBe(true)
  })

  it('laesst den Fluessigkeitsspiegel ueber dem Etikettband frei', () => {
    // Der Spiegel lag genau auf der Bandoberkante: im Braunglas unsichtbar, im
    // Klarglas verdeckte das Band die Oberflaeche und die Flasche wirkte wie
    // ein trueber Rest. Zwischen beiden muss Luft bleiben.
    expect(DROPS_SURFACE_Y).toBeLessThan(DROPS_LABEL_TOP - 10)
    // Und der Spiegel steht unter der Schulter, nicht darin: die Innenwand
    // wird erst ab y=154 gerade, darueber gibt es keine rechteckige Kammer.
    expect(DROPS_SURFACE_Y).toBeGreaterThan(154)
  })

  it('setzt das Etikettband auf den geraden Teil des Koerpers', () => {
    const oben = DROPS_VIEWBOX.y + DROPS_LABEL.topPct * DROPS_VIEWBOX.height
    const unten = oben + DROPS_LABEL.heightPct * DROPS_VIEWBOX.height
    // Unterhalb der Schulter und oberhalb des Bodens.
    expect(oben).toBeGreaterThan(152)
    expect(unten).toBeLessThan(288)
  })

  it('zeichnet die Wandstaerke ohne Oberkante bis in die Kappe', () => {
    // Der geschlossene Pfad wird zum Beschneiden gebraucht, gezeichnet ergaebe
    // sein Ringschluss aber einen waagerechten Strich quer ueber den Hals.
    expect(DROPS_INNER_PATH.endsWith('Z')).toBe(true)
    expect(DROPS_INNER_STROKE_PATH).not.toContain('Z')
    // Beide Enden liegen unter der Kappe, nicht darunter sichtbar.
    expect(DROPS_INNER_STROKE_TOP).toBeLessThan(DROPS_CAP.y + DROPS_CAP.height)
    expect(DROPS_INNER_STROKE_TOP).toBeGreaterThan(DROPS_CAP.y)
    expect(DROPS_INNER_STROKE_PATH.startsWith(`M41.6 ${DROPS_INNER_STROKE_TOP}`)).toBe(true)
    expect(DROPS_INNER_STROKE_PATH.endsWith(`L58.4 ${DROPS_INNER_STROKE_TOP}`)).toBe(true)
  })

  it('laesst die Pipette in die Kappe hineinreichen', () => {
    // Ohne Ueberdeckung klaffte an der Verbindung eine Fuge, sobald die Form
    // hochskaliert wird. Die Kappe deckt das obere Ende ab.
    expect(DROPS_PIPETTE_TOP).toBeLessThan(DROPS_CAP.y + DROPS_CAP.height)
    expect(DROPS_PIPETTE_TOP).toBeGreaterThan(DROPS_CAP.y)
    expect(DROPS_PIPETTE_OVERLAP).toBeGreaterThan(4)
  })

  it('zeichnet Kuppe und Kappe als einen Umriss', () => {
    // Ein gegossenes Teil, kein Gummisauger auf einem Deckel: ein Pfad von
    // der Spitze bis zur Unterkante, ohne Absatz dazwischen.
    expect(DROPS_CAP_PATH.startsWith('M42 30')).toBe(true)
    expect(DROPS_CAP_PATH).toContain('L70 112')
    expect(DROPS_CAP_PATH.endsWith('Z')).toBe(true)
    // Geriffelt ist nur der Zylinder, die Kuppe bleibt glatt.
    expect(DROPS_CAP_RIB_YS.top).toBeGreaterThan(DROPS_CAP.y)
    expect(DROPS_CAP_RIB_YS.bottom).toBeLessThan(DROPS_CAP.y + DROPS_CAP.height)
  })

  it('zieht den Kopf zwischen Kuppe und Zylinder wirklich ein', () => {
    // Der Kommentar versprach eine Einschnuerung, die Geometrie hatte keine:
    // Kuppe und Saeule waren gleich breit, danach ging es nur auseinander.
    // Das las sich als Trichter. Die Einschnuerung ist die schmalste Stelle
    // der ganzen Form.
    expect(DROPS_WIDTHS.waist).toBeLessThan(DROPS_WIDTHS.teat)
    // Sie liegt unter der Kuppe und ueber dem Zylinder.
    expect(DROPS_CAP_WAIST.top).toBeGreaterThan(DROPS_CAP_DOME.cy)
    expect(DROPS_CAP_WAIST.to).toBeLessThan(DROPS_CAP.y)
    // Und sie steht wirklich im Pfad, auf beiden Seiten spiegelgleich zu 50.
    const links = 50 - DROPS_WIDTHS.waist / 2
    const rechts = 50 + DROPS_WIDTHS.waist / 2
    expect(DROPS_CAP_PATH).toContain(`L${rechts} ${DROPS_CAP_WAIST.to}`)
    expect(DROPS_CAP_PATH).toContain(`L${links} ${DROPS_CAP_WAIST.from}`)
  })

  it('staffelt die Durchmesser von oben nach unten wie die Vorlage', () => {
    // Sauger schmaler als die Kappe, Kappe schmaler als der Koerper und
    // breiter als der Hals — diese Staffelung macht die Flasche auf einen
    // Blick als Pipettenflasche lesbar.
    expect(DROPS_WIDTHS.teat).toBeLessThan(DROPS_WIDTHS.cap)
    expect(DROPS_WIDTHS.neck).toBeLessThan(DROPS_WIDTHS.cap)
    expect(DROPS_WIDTHS.cap).toBeLessThan(DROPS_WIDTHS.body)
    expect(DROPS_CAP.width).toBe(DROPS_WIDTHS.cap)
    // Der Zylinder ist so hoch wie breit, keine schmale Bandage.
    expect(DROPS_CAP.height).toBe(DROPS_CAP.width)
  })
})
