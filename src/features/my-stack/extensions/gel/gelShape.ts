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

// FRONTANSICHT, wie jede andere Bühnenform. Vial, Ampulle, Nasenspray und
// Tropfen zeigen nie eine Deckfläche; ihre Rundheit kommt allein aus dem
// waagerechten Verlauf, und `liquidGeometry` hält die Flüssigkeitsoberfläche
// ausdrücklich flach. Eine frühere Fassung zeigte Deckel, Boden und
// Geloberfläche von leicht oben — in sich stimmig, aber quer zur Familie.

// ─── Deckel ─────────────────────────────────────────────────────────────────
//
// Glatt, ohne Riffelung — das ist das Unterscheidungsmerkmal zur Pulverdose.
// Flach gehalten: ein Tiegeldeckel ist eine Scheibe, kein Napf.
export const GEL_LID = { x: 5, y: 4, width: 150, height: 26 } as const
export const GEL_LID_RADIUS = 5
export const GEL_LID_PATH =
  'M10 4 L150 4 C152.8 4 155 6.2 155 9 L155 30 L5 30 L5 9 C5 6.2 7.2 4 10 4 Z'

// Die Fase: ein schmaler heller Streifen unter der Oberkante. In der Aufsicht
// war sie eine zweite Ellipse; in der Frontansicht ist sie ein Band.
export const GEL_LID_CHAMFER_Y = 10

// ─── Glaskörper ─────────────────────────────────────────────────────────────
export const GEL_BODY = { x: 9, y: 28, right: 151, bottom: 124, radius: 10 } as const
export const GEL_BODY_PATH =
  'M9 28 L151 28 L151 114 C151 119.5 146.5 124 141 124 L19 124 ' +
  'C13.5 124 9 119.5 9 114 L9 28 Z'

// Wandstärke wie bei den Glasformen, hier 5 Einheiten.
export const GEL_WALL = 5
export const GEL_CAVITY = { x: 14, right: 146, bottom: 119, radius: 6 } as const
export const GEL_INNER_TOP = 28
export const GEL_INNER_PATH =
  `M14 ${GEL_INNER_TOP} L146 ${GEL_INNER_TOP} L146 113 ` +
  'C146 116.3 143.3 119 140 119 L20 119 C16.7 119 14 116.3 14 113 Z'

// Die Naht: der Deckel überdeckt die Glasoberkante um zwei Einheiten.
export const GEL_SEAM_OVERLAP = GEL_LID.y + GEL_LID.height - GEL_BODY.y

// ─── Das Gel ────────────────────────────────────────────────────────────────
//
// Der inhaltliche Kern dieser Form. Jede flüssige Form benutzt LiquidGraphic:
// eine waagerechte Oberfläche, die sich beim Wischen neigt, dazu Bläschen und
// ein Pegel. Für Gel ist davon nichts richtig — es nivelliert sich nicht, es
// schwappt nicht, und einen aussagekräftigen Pegel gibt es nicht.
//
// In der Frontansicht ist die Oberfläche eine Linie. Dass Gel sich nicht
// nivelliert, steht in ihrer WÖLBUNG: sie hebt sich in der Mitte, während
// `liquidGeometry` seine Oberfläche ausdrücklich flach hält („real water is
// flat"). Das ist derselbe Unterschied wie vorher, nur ohne Aufsicht.
export const GEL_SURFACE = { cy: 54, bow: 3 } as const

// Der Körper der Masse, für einen gegebenen Wandanstieg. Nur die Oberkante
// kippt: das linke Ende sinkt um `rise`, das rechte steigt um denselben Betrag,
// der Boden bleibt liegen. Eine zähe Masse verliert den Kontakt zur Wand nicht.
//
// Der Kontrollpunkt der Quadratischen liegt doppelt so weit über der Mitte wie
// die gewünschte Wölbung — eine quadratische Bézier erreicht auf halbem Weg nur
// die Hälfte des Abstands zu ihrem Kontrollpunkt.
export function buildGelSurfacePath(rise = 0): string {
  const links = (GEL_SURFACE.cy - rise).toFixed(2)
  const rechts = (GEL_SURFACE.cy + rise).toFixed(2)
  const steuer = (GEL_SURFACE.cy - 2 * GEL_SURFACE.bow).toFixed(2)
  return `M14 ${links} Q 80 ${steuer} 146 ${rechts}`
}
export function buildGelBodyPath(rise = 0): string {
  return (
    `${buildGelSurfacePath(rise)} ` +
    'L146 113 C146 116.3 143.3 119 140 119 L20 119 C16.7 119 14 116.3 14 113 Z'
  )
}
export const GEL_BODY_FILL_PATH = buildGelBodyPath()

// Der Abstand zwischen Deckelunterkante und Oberfläche. Ein bis zum Rand
// gefüllter Tiegel sähe aus wie ein Farbtopf.
export const GEL_HEADROOM = GEL_SURFACE.cy - (GEL_LID.y + GEL_LID.height)

// ─── Etikett ────────────────────────────────────────────────────────────────
//
// Gerade Kanten: die gewölbten von vorher waren die Aufsicht in klein. Es klebt
// aussen auf dem Glas und läuft bis an die Silhouette — ein umlaufendes Etikett
// verschwindet an den Rändern um die Rundung herum.
//
// Es liegt in der Mitte der Masse, nicht über ihrem unteren Rand: die Masse
// reicht von 54 bis 119, das Band nimmt die mittleren 24 und lässt oben 21 und
// unten 20 stehen. Der Streifen unter dem Etikett ist der wichtigere — erst er
// zeigt, dass der Tiegel hinter dem Papier weitergeht.
export const GEL_LABEL = { top: 75, bottom: 99 } as const
export const GEL_LABEL_BOX = {
  x: GEL_BODY.x,
  y: GEL_LABEL.top,
  width: GEL_BODY.right - GEL_BODY.x,
  height: GEL_LABEL.bottom - GEL_LABEL.top,
} as const

export const GEL_NAME_TOP_PCT =
  ((GEL_LABEL.top + GEL_LABEL.bottom) / 2 - GEL_VIEWBOX.y) / GEL_VIEWBOX.height
export const GEL_NAME_INSET_PCT = (GEL_BODY.x + 7 - GEL_VIEWBOX.x) / GEL_VIEWBOX.width

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
