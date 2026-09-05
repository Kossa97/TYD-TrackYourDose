import type { StageFormSpec } from '../../stage/types'

// Tropfflasche mit Glaspipette. Gezeichnet auf einem Raster von 100 x 300
// Einheiten, die viewBox ist auf die Objektgrenzen beschnitten.
export const DROPS_VIEWBOX = { x: 8, y: 18, width: 84, height: 264 } as const
export const DROPS_ASPECT = DROPS_VIEWBOX.width / DROPS_VIEWBOX.height

// Der Gummiballon. Er ist der Verschluss und zugleich die einzige Stelle, an
// der color_hex am Objekt selbst auftaucht — echte Pipettenflaschen sind am
// Ballon farbkodiert.
export const DROPS_BULB_PATH =
  'M26 40 C26 22 74 22 74 40 L74 64 C74 70 70 72 64 72 L36 72 C30 72 26 70 26 64 Z'

// Der Schraubkragen zwischen Ballon und Flaschenhals.
export const DROPS_COLLAR = { x: 33, y: 72, width: 34, height: 22 } as const
export const DROPS_COLLAR_RIB_XS = [38, 44, 50, 56, 62] as const

// Aussen- und Innenkontur, wie beim Vial und der Ampulle. Die Wandstärke ist
// 5 % der Körperbreite.
export const DROPS_WALL = 4.2
export const DROPS_OUTER_PATH =
  'M33 72 L67 72 L67 94 C67 104 92 112 92 128 L92 268 C92 278 86 282 78 282 ' +
  'L22 282 C14 282 8 278 8 268 L8 128 C8 112 33 104 33 94 Z'
export const DROPS_INNER_PATH =
  'M37.2 76 L62.8 76 L62.8 96 C62.8 106 87.8 114 87.8 130 L87.8 266 ' +
  'C87.8 274 83 277.8 76.5 277.8 L23.5 277.8 C17 277.8 12.2 274 12.2 266 ' +
  'L12.2 130 C12.2 114 37.2 106 37.2 96 Z'

// Die Glaspipette steckt im Hals und reicht fast bis auf den Boden. Sie ist
// nur Glas: was hinter ihr liegt, scheint durch. Eine gefüllte Pipette wäre
// eine Aussage über eine Menge, die die App nicht kennt.
export const DROPS_PIPETTE_PATH = 'M46 96 L54 96 L54 246 L51 262 L49 262 L46 246 Z'

// Nur der gerade Teil des Innenraums. Das hält die Kammer rechteckig, so
// braucht die Geometrie kein Breitenprofil für die Schulter — derselbe
// Kunstgriff, den Vial, Ampulle und Nasenspray schon benutzen.
export const DROPS_CHAMBER = {
  x: 12.2,
  y: 140,
  width: 75.6,
  height: 137.8,
  aspect: 75.6 / 137.8,
} as const

// Fester Pegel. Die App kennt den Stand einer angebrochenen Tropfflasche
// nicht: getVialFillPct liest vials_in_stock, ein vial-spezifisches Altfeld.
// Die Grafik zeigt das Objekt, eine Prozentzahl wäre eine Behauptung.
export const DROPS_FILL = 0.72

// Das Etikettband sitzt auf dem geraden Teil des Körpers.
export const DROPS_LABEL = {
  topPct: (180 - DROPS_VIEWBOX.y) / DROPS_VIEWBOX.height,
  heightPct: 60 / DROPS_VIEWBOX.height,
} as const

// Wie weit Glanz und Schatten beim Wischen wandern.
export const DROPS_SHEEN_SHIFT = 16
export const DROPS_GROUND_SHIFT = 5

export const DROPS_SPEC: StageFormSpec = {
  viewBox: DROPS_VIEWBOX,
  chamber: DROPS_CHAMBER,
  // Siehe DROPS_FILL: kein echter Füllstand, deshalb keine Prozentzeile.
  hasMeaningfulFill: false,
}
