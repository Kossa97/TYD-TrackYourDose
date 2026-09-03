import type { StageFormSpec } from '../../stage/types'

// Gezeichnet auf einem Raster von 40 x 310 Einheiten; die viewBox ist auf die
// Objektgrenzen beschnitten. Sie steht zuerst, weil alle Prozentwerte darunter
// daraus hergeleitet werden.
export const PEN_VIEWBOX = { x: 0.5, y: 6, width: 39, height: 300 } as const

export const PEN_ASPECT = PEN_VIEWBOX.width / PEN_VIEWBOX.height

// Nadelkappe mit Clip. Sie schliesst oben ab und ist schmaler als der Koerper.
export const PEN_CAP_PATH = 'M6.5 12 C 6.5 6 33.5 6 33.5 12 L33.5 96 L6.5 96 Z'
export const PEN_CLIP_PATH = 'M29 16 L29 46 C 29 50 25.5 50 25.5 46 L25.5 20 Z'

// Gehäusekörper. Er trägt Ring, Dosisfenster und die längs laufende Schrift.
export const PEN_BODY = { x: 4, y: 96, width: 32, height: 154 } as const

// Der Farbring sitzt direkt unter der Kappe und ist die einzige Stelle, an der
// color_hex sichtbar wird — echte Pens sind farbkodiert.
export const PEN_RING = { x: 4, y: 96, width: 32, height: 10 } as const

// Dosisfenster. Die 0 ist der wahrheitsgemäße Ruhezustand eines nicht
// eingestellten Pens; die App kennt die eingestellte Dosis nicht.
export const PEN_DOSE_WINDOW = { x: 13, y: 196, width: 14, height: 17, rx: 2 } as const
export const PEN_DOSE_TEXT = '0'

// Der Dosierknopf ist die breiteste Stelle der ganzen Form und bestimmt damit
// den Umriss — nicht der Körper.
export const PEN_KNOB = { x: 0.5, y: 250, width: 39, height: 56, rx: 7 } as const
export const PEN_KNOB_RIB_XS = [8, 15, 22, 29] as const

// Der Knopf ist 39 Einheiten breit, der Körper 32. Ohne Vermittlung stoßen
// beide stumpf aneinander. Statt eines Absatzes weitet sich der Knopf konisch
// von der Körperbreite auf seine volle Breite — eine Schulter statt einer
// Stufe. Der Umriss bleibt dabei unverändert: unterhalb von FLARE_Y ist es
// exakt derselbe abgerundete Knopf wie zuvor.
export const PEN_KNOB_SHOULDER = { y: 246, flareY: 259 } as const

const KNOB_LEFT = PEN_KNOB.x
const KNOB_RIGHT = PEN_KNOB.x + PEN_KNOB.width
const KNOB_BOTTOM = PEN_KNOB.y + PEN_KNOB.height
const R = PEN_KNOB.rx

export const PEN_KNOB_PATH =
  `M${PEN_BODY.x} ${PEN_KNOB_SHOULDER.y} ` +
  `L${PEN_BODY.x + PEN_BODY.width} ${PEN_KNOB_SHOULDER.y} ` +
  `L${KNOB_RIGHT} ${PEN_KNOB_SHOULDER.flareY} ` +
  `L${KNOB_RIGHT} ${KNOB_BOTTOM - R} ` +
  `Q${KNOB_RIGHT} ${KNOB_BOTTOM} ${KNOB_RIGHT - R} ${KNOB_BOTTOM} ` +
  `L${KNOB_LEFT + R} ${KNOB_BOTTOM} ` +
  `Q${KNOB_LEFT} ${KNOB_BOTTOM} ${KNOB_LEFT} ${KNOB_BOTTOM - R} ` +
  `L${KNOB_LEFT} ${PEN_KNOB_SHOULDER.flareY} Z`

// Die Kante, an der der Koerper in die Schulter uebergeht, liegt auf
// Koerperbreite.
export const PEN_BODY_SHOULDER_X = {
  left: PEN_BODY.x,
  right: PEN_BODY.x + PEN_BODY.width,
} as const

// Die Rippen bleiben schlichte, gleich helle Striche. Sie beginnen unterhalb
// der Schulter und enden ueber der Fussrundung.
export const PEN_KNOB_RIB_YS = {
  top: PEN_KNOB.y + 9,
  bottom: PEN_KNOB.y + PEN_KNOB.height - 9,
} as const

// Der Name steht ueber dem Dosisfenster: zwischen der Unterkante des Farbrings
// und der Oberkante des Fensters. Das ist kuerzer als der ganze Koerper, aber
// die Anordnung "Anzeige unter dem Namen" war ausdruecklich gewuenscht.
export const PEN_NAME_ZONE = {
  top: PEN_RING.y + PEN_RING.height,
  bottom: PEN_DOSE_WINDOW.y,
} as const

export const PEN_NAME_TOP_PCT =
  ((PEN_NAME_ZONE.top + PEN_NAME_ZONE.bottom) / 2 - PEN_VIEWBOX.y) / PEN_VIEWBOX.height

// Die um 90 Grad gedrehte Hülle: vor der Drehung ist ihre Breite die
// Laufstrecke am Körper (also eine Höhe) und ihre Höhe die Körperbreite (also
// eine Breite). CSS löst Prozente immer gegen die eigene Achse auf, deshalb
// wird hier über das feste Seitenverhältnis umgerechnet.
export const PEN_NAME_RUN_PCT =
  ((PEN_NAME_ZONE.bottom - PEN_NAME_ZONE.top) / PEN_VIEWBOX.height) / PEN_ASPECT
export const PEN_NAME_BAND_PCT = (PEN_BODY.width / PEN_VIEWBOX.width) * PEN_ASPECT

// Das Dosisfenster wird von HTML überlagert, deshalb auch in Prozent.
export const PEN_DOSE_WINDOW_PCT = {
  left: (PEN_DOSE_WINDOW.x - PEN_VIEWBOX.x) / PEN_VIEWBOX.width,
  top: (PEN_DOSE_WINDOW.y - PEN_VIEWBOX.y) / PEN_VIEWBOX.height,
  width: PEN_DOSE_WINDOW.width / PEN_VIEWBOX.width,
  height: PEN_DOSE_WINDOW.height / PEN_VIEWBOX.height,
} as const

// Wie weit das Glanzband beim Wischen wandert.
export const PEN_SWEEP_SHIFT = 14

export const PEN_SPEC: StageFormSpec = {
  viewBox: PEN_VIEWBOX,
  // Kein Kartuschenfenster, keine sichtbare Flüssigkeit: damit weder
  // Etikettband noch Prozentzeile noch Schwappen.
  chamber: null,
  hasMeaningfulFill: false,
}
