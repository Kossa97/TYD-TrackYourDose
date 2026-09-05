import type { StageFormSpec } from '../../stage/types'

// Pulverdose mit Schraubdeckel, gezeichnet auf einem Raster von 120 x 170
// Einheiten; die viewBox ist auf die Objektgrenzen beschnitten, wie bei
// Ampulle, Nasenspray und Tube. Sie steht zuerst, weil Seitenverhältnis und
// Namenslage daraus hergeleitet werden.
export const POWDER_VIEWBOX = { x: 10, y: 6, width: 100, height: 150 } as const
export const POWDER_ASPECT = POWDER_VIEWBOX.width / POWDER_VIEWBOX.height

// Der Deckel ist breiter als der Korpus. Das ist der Unterschied zwischen
// „aufgeschraubt" und „oberes Drittel andersfarbig": ohne den Überstand liest
// sich die Trennlinie als Segment derselben Dose.
export const POWDER_WIDTHS = { lid: 100, body: 96 } as const

// ─── Deckel ─────────────────────────────────────────────────────────────────
//
// FRONTANSICHT, wie jede andere Bühnenform. Vial, Ampulle, Nasenspray und
// Tropfen zeigen nie eine Deckfläche; ihre Rundheit kommt allein aus dem
// waagerechten Verlauf. Eine frühere Fassung dieser Dose zeigte die Kappe von
// leicht oben — konsequent in sich, aber quer zur Familie, und im Karussell
// neben einem Vial sofort als Bruch zu sehen.
export const POWDER_LID = { x: 10, y: 6, width: 100, height: 32 } as const
export const POWDER_LID_RADIUS = 4
export const POWDER_LID_PATH =
  'M14 6 L106 6 C108.2 6 110 7.8 110 10 L110 38 L10 38 L10 10 C10 7.8 11.8 6 14 6 Z'

// Der glatte Rand über der Riffelung, den jede Schraubkappe hat.
export const POWDER_LID_TOP_BAND = 6

// Die Riffelung. Sie wird weiterhin über den Winkel um die Zylinderachse
// verteilt, nicht über den Abstand auf dem Bildschirm: die Rillen rücken zu
// den Rändern hin zusammen, wie es die Verkürzung verlangt.
//
// Das ist KEIN Aufsicht-Merkmal — es folgt aus der waagerechten Krümmung und
// gilt in der Frontansicht genauso. Weggefallen sind nur die senkrechten
// Versätze: alle Rillen beginnen und enden jetzt auf derselben Höhe, weil es
// keinen elliptischen Rand mehr gibt, auf dem sie aufsetzen könnten.
export const POWDER_LID_RIB_YS = { top: 14, bottom: 34 } as const
const RIB_SPAN_DEG = 78
const RIB_COUNT = 34
export interface PowderRib {
  x: number
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
    x: Number((POWDER_LID.x + POWDER_LID.width / 2 + (POWDER_LID.width / 2) * Math.sin(phi)).toFixed(2)),
    groove: Number((0.16 + 0.26 * (1 - cos)).toFixed(3)),
    highlight: Number((0.34 * lit).toFixed(3)),
  }
})

// ─── Korpus ─────────────────────────────────────────────────────────────────
//
// Gerader Zylinder mit eingerundetem Fuß. Kein Bodenbogen: der wäre wieder
// eine Aufsicht.
export const POWDER_BODY = { x: 12, y: 36, bottom: 156, radius: 8 } as const
export const POWDER_BODY_PATH =
  'M12 36 L108 36 L108 148 C108 152.4 104.4 156 100 156 L20 156 ' +
  'C15.6 156 12 152.4 12 148 L12 38 Z'

// Die Naht: der Deckel überdeckt die Korpusoberkante um zwei Einheiten. Ein
// stumpfer Stoß zeigt je nach Skalierung eine Haarlinie — derselbe Grund wie
// beim Sauger der Tropfflasche.
export const POWDER_SEAM_OVERLAP = POWDER_LID.y + POWDER_LID.height - POWDER_BODY.y

// ─── Etikett ────────────────────────────────────────────────────────────────
//
// Gerade Kanten. Die gewölbten von vorher waren die Aufsicht in klein: ein
// waagerecht umlaufendes Band wölbt sich nur, wenn man von oben auf die Dose
// sieht. In der Frontansicht ist es ein Strich, wie das Etikettband am Vial.
export const POWDER_LABEL = { top: 76, bottom: 118, inset: 4 } as const
const LX = POWDER_BODY.x + POWDER_LABEL.inset
const RX = POWDER_BODY.x + POWDER_WIDTHS.body - POWDER_LABEL.inset
export const POWDER_LABEL_BOX = {
  x: LX,
  y: POWDER_LABEL.top,
  width: RX - LX,
  height: POWDER_LABEL.bottom - POWDER_LABEL.top,
} as const

// Mitte der Aufschrift in der Mitte des Etiketts.
export const POWDER_NAME_TOP_PCT =
  ((POWDER_LABEL.top + POWDER_LABEL.bottom) / 2 - POWDER_VIEWBOX.y) / POWDER_VIEWBOX.height

// Der Einzug wird hergeleitet statt geraten: er ist der Rand des Etiketts.
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
