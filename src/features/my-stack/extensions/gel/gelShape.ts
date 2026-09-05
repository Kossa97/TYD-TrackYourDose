import type { StageFormSpec } from '../../stage/types'

// Gel-Tiegel: flacher Glasbehälter mit glattem Schraubdeckel, gezeichnet auf
// einem Raster von 160 x 128 Einheiten; die viewBox ist auf die Objektgrenzen
// beschnitten. Sie steht zuerst, weil Seitenverhältnis und Namenslage daraus
// hergeleitet werden.
//
// Es ist die erste Form, die BREITER ALS HOCH ist. Das ist kein Zufall,
// sondern das Unterscheidungsmerkmal: Pulverdose (0,641) und Tube (0,280)
// stehen beide hochkant, ein Tiegel liegt breit. Schon die Silhouette schliesst
// die Verwechslung aus.
export const GEL_VIEWBOX = { x: 5, y: 4, width: 150, height: 120 } as const
export const GEL_ASPECT = GEL_VIEWBOX.width / GEL_VIEWBOX.height

// Wie bei der Pulverdose gilt: jede waagerechte Kante ist ein Ellipsenbogen,
// kein Strich. Deckelrand, Glasboden, Geloberfläche und Etikettkanten folgen
// alle demselben Satz.

// ─── Deckel ─────────────────────────────────────────────────────────────────
//
// Glatt, ohne Riffelung — das ist der zweite Unterschied zur Pulverdose. Sie
// hat ihre Rillen, er hat seine Fase.
//
// Flach gehalten: ein Tiegeldeckel ist eine Scheibe, kein Napf. Mit einem
// Drittel der Bauhöhe wirkte er kopflastig und die Form kippte optisch zur
// Pulverdose zurück, deren Deckel hoch ist.
export const GEL_LID_RIM = { cx: 80, cy: 11, rx: 75, ry: 7 } as const
export const GEL_LID_BOTTOM_Y = 27
export const GEL_LID_PATH =
  `M5 ${GEL_LID_RIM.cy} ` +
  `A ${GEL_LID_RIM.rx} ${GEL_LID_RIM.ry} 0 0 1 155 ${GEL_LID_RIM.cy} ` +
  `L155 ${GEL_LID_BOTTOM_Y} ` +
  `A ${GEL_LID_RIM.rx} ${GEL_LID_RIM.ry} 0 0 1 5 ${GEL_LID_BOTTOM_Y} Z`

// Die Fase auf der Deckfläche: eine zweite Ellipse mit eigener Kante. Ohne sie
// wäre die glatte Kappe eine einzige Farbfläche.
export const GEL_LID_CHAMFER = { rx: GEL_LID_RIM.rx - 11, ry: GEL_LID_RIM.ry - 1.6 } as const

// ─── Glaskörper ─────────────────────────────────────────────────────────────
export const GEL_BASE = { cx: 80, cy: 116, rx: 67, ry: 7 } as const
export const GEL_BODY = { x: 13, y: 30, bottom: GEL_BASE.cy + GEL_BASE.ry } as const
export const GEL_BODY_PATH =
  `M13 30 L13 ${GEL_BASE.cy} ` +
  `A ${GEL_BASE.rx} ${GEL_BASE.ry} 0 0 0 147 ${GEL_BASE.cy} ` +
  'L147 30 Z'

// Wandstärke wie bei den Glasformen, hier 5 Einheiten.
export const GEL_WALL = 5
export const GEL_INNER_BASE = { cx: 80, cy: 111, rx: 62, ry: 6.5 } as const
// Die Oberkante liegt auf der des Glases, nicht darunter: der vordere Bogen
// des Deckelrandes reicht an den Rändern bis y=30,9 herab, und nur was darüber
// endet, deckt er ab. Bei y=35 stand der waagerechte Ringschluss frei im Glas
// und las sich als aufgemaltes Rechteck — derselbe Fehler wie bei der Kontur
// der Pulverdose, nur eine Ebene tiefer.
export const GEL_INNER_TOP = 30
export const GEL_INNER_PATH =
  `M18 ${GEL_INNER_TOP} L18 ${GEL_INNER_BASE.cy} ` +
  `A ${GEL_INNER_BASE.rx} ${GEL_INNER_BASE.ry} 0 0 0 142 ${GEL_INNER_BASE.cy} ` +
  `L142 ${GEL_INNER_TOP} Z`

// Die Naht: der Deckelrand überdeckt die Glasoberkante. Sein vorderer Bogen
// reicht bis y=34 herunter, die Glasoberkante liegt bei 30 — auch an den
// Rändern, wo der Bogen am höchsten steht, bleibt sie darunter.
export const GEL_SEAM_OVERLAP = GEL_LID_BOTTOM_Y + GEL_LID_RIM.ry - GEL_BODY.y

// ─── Das Gel ────────────────────────────────────────────────────────────────
//
// Der inhaltliche Kern dieser Form. Jede flüssige Form benutzt LiquidGraphic:
// eine waagerechte Oberfläche, die sich beim Wischen neigt, dazu Bläschen und
// ein Pegel. Für Gel ist davon nichts richtig — es nivelliert sich nicht, es
// schwappt nicht, und einen aussagekräftigen Pegel gibt es nicht.
//
// Die Masse wird deshalb eigens gezeichnet: ein Körper, dessen obere Kante der
// vordere Bogen der Oberflächenellipse ist, darüber die Ellipse selbst als
// Aufsicht auf das Gel. Derselbe Kunstgriff wie bei der Deckfläche der
// Pulverdose, nur für den Inhalt.
export const GEL_SURFACE = { cx: 80, cy: 54, rx: 62, ry: 6.5 } as const
export const GEL_BODY_FILL_PATH =
  `M18 ${GEL_SURFACE.cy} ` +
  `A ${GEL_SURFACE.rx} ${GEL_SURFACE.ry} 0 0 0 142 ${GEL_SURFACE.cy} ` +
  `L142 ${GEL_INNER_BASE.cy} ` +
  `A ${GEL_INNER_BASE.rx} ${GEL_INNER_BASE.ry} 0 0 1 18 ${GEL_INNER_BASE.cy} Z`

// Die Wölbung: Gel nivelliert sich nicht, seine Oberfläche steht in der Mitte
// höher als am Rand. Gezeichnet als zweite, kleinere Ellipse über der ersten —
// eine flache Ellipse allein liest sich als Flüssigkeitsspiegel, und genau das
// ist Gel nicht.
export const GEL_DOME = {
  cx: GEL_SURFACE.cx,
  cy: GEL_SURFACE.cy - 2.4,
  rx: GEL_SURFACE.rx - 13,
  ry: GEL_SURFACE.ry - 1.4,
} as const

// Der Abstand zwischen Deckelunterkante und Oberfläche. Ein bis zum Rand
// gefüllter Tiegel sähe aus wie ein Farbtopf.
export const GEL_HEADROOM = GEL_SURFACE.cy - GEL_LID_BOTTOM_Y

// ─── Etikett ────────────────────────────────────────────────────────────────
//
// Das Band sitzt so, dass die Masse OBEN UND UNTEN daran vorbeischaut. An der
// Mittellinie — dort, wo das Auge sie liest — reicht sie vom vorderen Bogen
// der Oberfläche (60,5) bis zum vorderen Bogen des Bodens (117,5), also über
// 57 Einheiten. Das Band nimmt die mittleren 24 davon und lässt oben wie unten
// 16,5 stehen.
//
// Vorher lag es bei 84 bis 112: darüber 23,5 Einheiten, darunter 5,5. Damit
// schnitt es die Masse unten ab, statt auf ihr zu liegen — ein aufgeklebtes
// Etikett endet aber über dem Boden, und erst der Streifen darunter zeigt,
// dass der Tiegel hinter dem Papier weitergeht.
//
// Es klebt AUSSEN auf dem Glas und läuft deshalb bis an die Silhouette — ein
// umlaufendes Etikett verschwindet an den Rändern um die Rundung herum, es
// hört nicht davor auf. Mit Einzug spannte es nur über den Innenraum, und die
// beiden Streifen Glas daneben liessen es hinter der Wand liegen statt darauf.
// Sein Radius ist folgerichtig der des Körpers, nicht der des Innenraums.
export const GEL_LABEL = { top: 77, bottom: 101, ry: 5.5 } as const
const LX = GEL_BODY.x
const RX = 147
const LABEL_RX = (RX - LX) / 2
export const GEL_LABEL_PATH =
  `M${LX} ${GEL_LABEL.top} ` +
  `A ${LABEL_RX} ${GEL_LABEL.ry} 0 0 0 ${RX} ${GEL_LABEL.top} ` +
  `L${RX} ${GEL_LABEL.bottom} ` +
  `A ${LABEL_RX} ${GEL_LABEL.ry} 0 0 1 ${LX} ${GEL_LABEL.bottom} Z`

export const GEL_NAME_TOP_PCT =
  ((GEL_LABEL.top + GEL_LABEL.bottom) / 2 - GEL_VIEWBOX.y) / GEL_VIEWBOX.height
export const GEL_NAME_INSET_PCT = (LX + 7 - GEL_VIEWBOX.x) / GEL_VIEWBOX.width

// Wie weit Glanz und Bodenschatten beim Wischen wandern.
export const GEL_SHEEN_SHIFT = 20
export const GEL_GROUND_SHIFT = 7

export const GEL_SPEC: StageFormSpec = {
  viewBox: GEL_VIEWBOX,
  // Gel ist keine Flüssigkeit: keine Kammer, damit weder Etikettband noch
  // Prozentzeile noch Schwappen. Der sichtbare Inhalt wird eigens gezeichnet.
  chamber: null,
  hasMeaningfulFill: false,
}
