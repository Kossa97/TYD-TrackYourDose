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

// Deckel: niedrig, breit, geriffelt, mit leicht gebrochenen Oberkanten.
export const POWDER_LID = { x: 10, y: 6, width: 100, height: 34 } as const
export const POWDER_LID_RADIUS = 5
export const POWDER_LID_PATH =
  'M15 6 L105 6 C107.8 6 110 8.2 110 11 L110 40 L10 40 L10 11 C10 8.2 12.2 6 15 6 Z'

// Die flache Oberseite des Deckels zeigt nach oben, vom Licht weg, und ist
// deshalb dunkler als der Mantel. Ohne diesen Streifen läge der Deckel flach
// auf der Dose statt auf ihr.
export const POWDER_LID_TOP_BAND = 6

// Geriffelt ist nur der Mantel, nicht die gebrochene Oberkante.
export const POWDER_LID_RIB_YS = { top: 15, bottom: 37 } as const
export const POWDER_LID_RIB_XS: readonly number[] =
  Array.from({ length: 25 }, (_, i) => Number((13 + i * 3.5).toFixed(3)))

// Korpus: gerader Zylinder, unten eingerundet. Die Schulter ist der Streifen
// zwischen Deckelunterkante und dem Punkt, ab dem der Mantel gerade läuft.
export const POWDER_BODY = { x: 12, y: 38, bottom: 156, radius: 8 } as const
export const POWDER_BODY_PATH =
  'M12 38 L108 38 L108 148 C108 152.4 104.4 156 100 156 L20 156 ' +
  'C15.6 156 12 152.4 12 148 L12 38 Z'

// Die Naht: der Deckel überdeckt die Korpusoberkante um zwei Einheiten. Ein
// stumpfer Stoß zeigt je nach Skalierung eine Haarlinie — derselbe Grund wie
// beim Sauger der Tropfflasche.
export const POWDER_SEAM_OVERLAP = POWDER_LID.y + POWDER_LID.height - POWDER_BODY.y

// Mitte der Aufschrift auf 62 % der Objekthöhe: unterhalb des Deckels, mittig
// im sichtbaren Korpus statt mittig in der ganzen Form.
export const POWDER_NAME_TOP_PCT = 0.62

// Der Einzug ist der Abstand des Korpus zum viewBox-Rand. Er wird hergeleitet
// statt geraten: der Korpus ist schmaler als der Deckel, also schmaler als die
// viewBox — bei der Tube war es die Verjüngung, hier der Deckelüberstand.
export const POWDER_NAME_INSET_PCT =
  (POWDER_BODY.x + 6 - POWDER_VIEWBOX.x) / POWDER_VIEWBOX.width

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
