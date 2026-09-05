import type { StageFormSpec } from '../../stage/types'

// Pulverdose mit Schraubdeckel, gezeichnet auf einem Raster von 120 x 170
// Einheiten; die viewBox ist auf die Objektgrenzen beschnitten, wie bei
// Ampulle, Nasenspray und Tube. Sie steht zuerst, weil Seitenverhältnis und
// Namenslage daraus hergeleitet werden.
export const POWDER_VIEWBOX = { x: 10, y: 6, width: 100, height: 156 } as const
export const POWDER_ASPECT = POWDER_VIEWBOX.width / POWDER_VIEWBOX.height

// Der Deckel ist breiter als der Korpus. Das ist der Unterschied zwischen
// „aufgeschraubt" und „oberes Drittel andersfarbig": ohne den Überstand liest
// sich die Trennlinie als Segment derselben Dose.
export const POWDER_WIDTHS = { lid: 100, body: 96 } as const

// ─── Der Deckel als Zylinder ────────────────────────────────────────────────
//
// Von leicht oben gesehen ist der Rand eines Zylinders eine Ellipse, keine
// Gerade. Alles am Deckel folgt daraus: die Deckfläche, beide Ränder und vor
// allem die Riffelung.
export const POWDER_LID_RIM = { cx: 60, cy: 12.5, rx: 50, ry: 6.5 } as const
export const POWDER_LID_BOTTOM_Y = 37.5
export const POWDER_LID = {
  x: POWDER_LID_RIM.cx - POWDER_LID_RIM.rx,
  y: POWDER_LID_RIM.cy - POWDER_LID_RIM.ry,
  width: POWDER_LID_RIM.rx * 2,
  height: POWDER_LID_BOTTOM_Y + POWDER_LID_RIM.ry - (POWDER_LID_RIM.cy - POWDER_LID_RIM.ry),
} as const

// Silhouette: über den hinteren Rand hinweg, an der Seite herunter, unter dem
// vorderen Rand zurück. Beide Bögen wölben sich nach aussen, weil man auf die
// Dose herabsieht.
export const POWDER_LID_PATH =
  `M10 ${POWDER_LID_RIM.cy} ` +
  `A ${POWDER_LID_RIM.rx} ${POWDER_LID_RIM.ry} 0 0 1 110 ${POWDER_LID_RIM.cy} ` +
  `L110 ${POWDER_LID_BOTTOM_Y} ` +
  `A ${POWDER_LID_RIM.rx} ${POWDER_LID_RIM.ry} 0 0 1 10 ${POWDER_LID_BOTTOM_Y} Z`

// Die Riffelung. Sie wird über den Winkel um die Zylinderachse verteilt, nicht
// über den Abstand auf dem Bildschirm: dadurch rücken die Rillen zu den Rändern
// hin von selbst zusammen, wie es die Verkürzung verlangt. Vorher waren sie
// gleichmässig verteilt und die Kappe las sich flach.
//
// Jede Rille beginnt auf dem vorderen Bogen des oberen Randes — deshalb sind
// die äusseren kürzer angesetzt als die mittleren. Genau das ist der
// Unterschied zu Linien, die an einer geraden Kante abgeschnitten werden.
const RIB_SPAN_DEG = 78
const RIB_COUNT = 34
export interface PowderRib {
  x: number
  yTop: number
  yBottom: number
  // Wie stark die Rille im Schatten liegt, und wie hell ihre Kante daneben.
  groove: number
  highlight: number
}
export const POWDER_LID_RIBS: readonly PowderRib[] = Array.from({ length: RIB_COUNT }, (_, i) => {
  const phi = (-RIB_SPAN_DEG + (2 * RIB_SPAN_DEG * i) / (RIB_COUNT - 1)) * (Math.PI / 180)
  const cos = Math.cos(phi)
  // Die Lampe steht links oben, wie bei allen Bühnenformen.
  const lit = Math.max(0, Math.cos(phi + 0.6))
  return {
    x: Number((POWDER_LID_RIM.cx + POWDER_LID_RIM.rx * Math.sin(phi)).toFixed(2)),
    yTop: Number((POWDER_LID_RIM.cy + POWDER_LID_RIM.ry * cos).toFixed(2)),
    yBottom: Number((POWDER_LID_BOTTOM_Y + POWDER_LID_RIM.ry * cos).toFixed(2)),
    groove: Number((0.16 + 0.26 * (1 - cos)).toFixed(3)),
    highlight: Number((0.34 * lit).toFixed(3)),
  }
})

// ─── Der Korpus als Zylinder ────────────────────────────────────────────────
//
// Derselbe Grundsatz unten: der Boden ist ein Bogen, kein gerundetes Rechteck.
export const POWDER_BASE = { cx: 60, cy: 150.5, rx: 48, ry: 5.5 } as const
export const POWDER_BODY = { x: 12, y: 38, bottom: POWDER_BASE.cy + POWDER_BASE.ry } as const
export const POWDER_BODY_PATH =
  `M12 38 L12 ${POWDER_BASE.cy} ` +
  `A ${POWDER_BASE.rx} ${POWDER_BASE.ry} 0 0 0 108 ${POWDER_BASE.cy} ` +
  'L108 38 Z'

// Die Naht: der Deckel überdeckt die Korpusoberkante. Ein stumpfer Stoss zeigt
// je nach Skalierung eine Haarlinie — derselbe Grund wie beim Sauger der
// Tropfflasche.
export const POWDER_SEAM_OVERLAP = POWDER_LID_BOTTOM_Y + POWDER_LID_RIM.ry - POWDER_BODY.y

// ─── Das Etikett ────────────────────────────────────────────────────────────
//
// Ein umlaufendes Etikett, wie es jede Dose trägt. Seine Ober- und Unterkante
// sind Bögen mit derselben Wölbung wie die Ränder: ein waagerecht umlaufendes
// Band ist auf einem Zylinder unter Augenhöhe kein gerader Strich. Ohne diese
// beiden Bögen klebte ein flaches Rechteck auf einer runden Dose.
export const POWDER_LABEL = { top: 66, bottom: 122, inset: 4, ry: 4.5 } as const
const LX = POWDER_BODY.x + POWDER_LABEL.inset
const RX = POWDER_BODY.x + POWDER_WIDTHS.body - POWDER_LABEL.inset
const LABEL_RX = (RX - LX) / 2
export const POWDER_LABEL_PATH =
  `M${LX} ${POWDER_LABEL.top} ` +
  `A ${LABEL_RX} ${POWDER_LABEL.ry} 0 0 0 ${RX} ${POWDER_LABEL.top} ` +
  `L${RX} ${POWDER_LABEL.bottom} ` +
  `A ${LABEL_RX} ${POWDER_LABEL.ry} 0 0 1 ${LX} ${POWDER_LABEL.bottom} Z`

// Der farbige Fussstreifen des Etiketts. Seine Oberkante ist derselbe Bogen
// wie die Etikettkanten — als gerader Strich wäre er das einzige flache Teil
// auf einer runden Dose, und genau daran erkennt man aufgeklebte Grafik.
export const POWDER_LABEL_STRIPE_TOP = POWDER_LABEL.bottom - 13
export const POWDER_LABEL_STRIPE_PATH =
  `M${LX} ${POWDER_LABEL_STRIPE_TOP} ` +
  `A ${LABEL_RX} ${POWDER_LABEL.ry} 0 0 0 ${RX} ${POWDER_LABEL_STRIPE_TOP} ` +
  `L${RX} ${POWDER_LABEL.bottom} ` +
  `A ${LABEL_RX} ${POWDER_LABEL.ry} 0 0 1 ${LX} ${POWDER_LABEL.bottom} Z`

// Mitte der Aufschrift in der Mitte des Etiketts, nicht der ganzen Form.
export const POWDER_NAME_TOP_PCT =
  ((POWDER_LABEL.top + POWDER_LABEL_STRIPE_TOP) / 2 - POWDER_VIEWBOX.y) / POWDER_VIEWBOX.height

// Der Einzug wird hergeleitet statt geraten: er ist der Rand des Etiketts,
// nicht der des Korpus. Bei der Tube war es die Verjüngung, hier das Etikett.
export const POWDER_NAME_INSET_PCT = (LX + 3 - POWDER_VIEWBOX.x) / POWDER_VIEWBOX.width

// Wie weit Glanz und Bodenschatten beim Wischen wandern.
export const POWDER_SHEEN_SHIFT = 16
export const POWDER_GROUND_SHIFT = 6

export const POWDER_SPEC: StageFormSpec = {
  viewBox: POWDER_VIEWBOX,
  // Undurchsichtiges Pulver in einer undurchsichtigen Dose: keine Kammer,
  // damit weder Etikettband noch Prozentzeile. Wie Tube und Pflaster.
  chamber: null,
  hasMeaningfulFill: false,
}
