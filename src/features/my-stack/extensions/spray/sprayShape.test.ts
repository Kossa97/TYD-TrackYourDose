import { describe, expect, it } from 'vitest'
import { carriesLabel } from '../../stage/types'
import { NASAL_SPRAY_SPEC } from '../nasal-spray/nasalSprayShape'
import {
  SPRAY_ACTUATOR,
  SPRAY_ASPECT,
  SPRAY_CHAMBER,
  SPRAY_COLLAR,
  SPRAY_COLLAR_RIB_XS,
  SPRAY_COLLAR_RIB_YS,
  SPRAY_DIP_TUBE,
  SPRAY_FILL,
  SPRAY_INNER_PATH,
  SPRAY_LABEL,
  SPRAY_LABEL_INSET_PCT,
  SPRAY_NOZZLE,
  SPRAY_NOZZLE_MOUTH,
  SPRAY_OUTER_PATH,
  SPRAY_SPEC,
  SPRAY_SURFACE_Y,
  SPRAY_VIEWBOX,
  SPRAY_WALL,
  SPRAY_WIDTHS,
} from './sprayShape'

describe('sprayShape', () => {
  it('steht als Flasche im Rahmen, mit Platz fuer die Duese', () => {
    expect(SPRAY_SPEC.viewBox).toEqual({ x: 23, y: 72, width: 74, height: 220 })
    // Eine stehende Flasche: hoeher als breit.
    expect(SPRAY_ASPECT).toBeLessThan(1)
    // Die Flasche steht mittig im Rahmen, obwohl die Duese nur nach rechts
    // steht: sonst haengt die ganze Reihe schief.
    const rahmenMitte = SPRAY_VIEWBOX.x + SPRAY_VIEWBOX.width / 2
    expect(rahmenMitte).toBe(60)
    // Und die Duese passt noch hinein.
    expect(SPRAY_NOZZLE.x + SPRAY_NOZZLE.width).toBeLessThan(SPRAY_VIEWBOX.x + SPRAY_VIEWBOX.width)
    expect(SPRAY_NOZZLE_MOUTH.cx + SPRAY_NOZZLE_MOUTH.r)
      .toBeLessThanOrEqual(SPRAY_NOZZLE.x + SPRAY_NOZZLE.width)
  })

  it('ist als andere Flasche gebaut als das Nasenspray', () => {
    // Der ganze Zweck der Form. Zwei Pumpflaschen, die sich nur in der Groesse
    // unterscheiden, waeren eine zu viel.
    const nasal = NASAL_SPRAY_SPEC.chamber!
    expect(SPRAY_WIDTHS.body).toBeLessThan(78)
    expect(SPRAY_CHAMBER.width).toBeLessThan(nasal.width)
    // Und sie ist schlanker, nicht nur kleiner: das Verhaeltnis Breite zu Hoehe
    // faellt.
    expect(SPRAY_CHAMBER.aspect).toBeLessThan(nasal.aspect)
  })

  it('setzt die Duese unter den Druckkopf, nicht an seine Kante', () => {
    // Eine Duese, die genau an der gerundeten Kopfkante ansetzt, laesst einen
    // keilfoermigen Spalt stehen. Sie muss unter den Kopf reichen.
    const kopfRechts = SPRAY_ACTUATOR.x + SPRAY_ACTUATOR.width
    expect(SPRAY_NOZZLE.x).toBeLessThan(kopfRechts)
    expect(kopfRechts - SPRAY_NOZZLE.x).toBeGreaterThanOrEqual(SPRAY_ACTUATOR.rx)
    // Und sie sitzt auf halber Kopfhoehe, nicht am oberen Rand.
    const duesenMitte = SPRAY_NOZZLE.y + SPRAY_NOZZLE.height / 2
    const kopfMitte = SPRAY_ACTUATOR.y + SPRAY_ACTUATOR.height / 2
    expect(Math.abs(duesenMitte - kopfMitte)).toBeLessThan(2)
  })

  it('haelt die Innenkontur ueberall innerhalb der Aussenkontur', () => {
    // Die Wandstaerke ist 5 % der Koerperbreite, wie bei Vial, Ampulle und
    // Tropfflasche.
    expect(SPRAY_WALL).toBeCloseTo(SPRAY_WIDTHS.body * 0.05, 1)
    expect(SPRAY_OUTER_PATH.startsWith('M50 108')).toBe(true)
    expect(SPRAY_INNER_PATH.startsWith('M52.5 111')).toBe(true)
    // Beide schliessen mit Z, sonst faerbt der offene Pfad die Silhouette.
    expect(SPRAY_OUTER_PATH.endsWith('Z')).toBe(true)
    expect(SPRAY_INNER_PATH.endsWith('Z')).toBe(true)
  })

  it('haelt den Kragen lueckenlos zwischen Kopf und Hals', () => {
    // Eine Luecke zeigte sich beim Nasenspray als heller Spalt.
    expect(SPRAY_COLLAR.y).toBe(SPRAY_ACTUATOR.y + SPRAY_ACTUATOR.height)
    // Der Kragen ist schmaler als der Kopf und breiter als der Hals.
    expect(SPRAY_COLLAR.width).toBeLessThan(SPRAY_ACTUATOR.width)
    expect(SPRAY_COLLAR.width).toBeGreaterThan(SPRAY_WIDTHS.neck)
    // Die Riffelung liegt vollstaendig auf dem Kragen.
    expect(SPRAY_COLLAR_RIB_XS[0]).toBeGreaterThan(SPRAY_COLLAR.x)
    expect(SPRAY_COLLAR_RIB_XS.at(-1)!).toBeLessThan(SPRAY_COLLAR.x + SPRAY_COLLAR.width)
    expect(SPRAY_COLLAR_RIB_YS.top).toBeGreaterThan(SPRAY_COLLAR.y)
    expect(SPRAY_COLLAR_RIB_YS.bottom).toBeLessThan(SPRAY_COLLAR.y + SPRAY_COLLAR.height)
  })

  it('haengt das Steigrohr an den Kopf und laesst es ueber dem Boden enden', () => {
    // Ohne Rohr gaebe es keinen Weg nach oben und die Pumpe waere Dekoration —
    // mit einem Rohr, das auf dem Boden aufsteht, saugte sie nichts an.
    expect(SPRAY_DIP_TUBE.top).toBeLessThan(SPRAY_CHAMBER.y)
    expect(SPRAY_DIP_TUBE.bottom).toBeLessThan(SPRAY_CHAMBER.y + SPRAY_CHAMBER.height)
    // Und es steht ein Stueck frei im Kopfraum, sonst ist es kein Rohr,
    // sondern eine Naht in der Fluessigkeit.
    expect(SPRAY_SURFACE_Y - SPRAY_DIP_TUBE.top).toBeGreaterThan(20)
    // Mittig, also unter dem Ventil im Kopf.
    expect(SPRAY_DIP_TUBE.x + SPRAY_DIP_TUBE.width / 2).toBeCloseTo(60, 1)
  })

  it('laesst den Inhalt ueber UND unter dem Etikett stehen', () => {
    // Die Regel, die beim Gel aufgestellt wurde: ein Band, das den Pegel
    // verdeckt, nimmt der Form ihren Inhalt.
    expect(SPRAY_SURFACE_Y).toBeLessThan(SPRAY_LABEL.top)
    expect(SPRAY_LABEL.bottom).toBeLessThan(SPRAY_CHAMBER.y + SPRAY_CHAMBER.height)
    // Der Pegel folgt SPRAY_FILL, er ist nicht getippt.
    expect(SPRAY_SURFACE_Y).toBeCloseTo(SPRAY_CHAMBER.y + SPRAY_CHAMBER.height * (1 - SPRAY_FILL), 5)
  })

  it('zieht das Etikett auf die Flaschenbreite ein', () => {
    // Die viewBox ist wegen der Duese breiter als das Glas. Ohne Einzug staende
    // das Band rechts und links in der Luft.
    expect(SPRAY_LABEL_INSET_PCT).toBeGreaterThan(0)
    const bandLinks = SPRAY_VIEWBOX.x + SPRAY_LABEL_INSET_PCT * SPRAY_VIEWBOX.width
    expect(bandLinks).toBeCloseTo(60 - SPRAY_WIDTHS.body / 2, 5)
  })

  it('traegt ein Etikett und keinen Pegel', () => {
    expect(carriesLabel(SPRAY_SPEC)).toBe(true)
    // Wie beim Nasenspray: die App kennt den Stand der offenen Flasche nicht.
    expect(SPRAY_SPEC.hasMeaningfulFill).toBe(false)
  })
})
