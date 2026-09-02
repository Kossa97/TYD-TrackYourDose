import type { StageFormSpec } from '../../stage/types'

// Gezeichnet auf einem Raster von 120 x 294 Einheiten; die viewBox ist auf die
// Objektgrenzen beschnitten, wie bei Ampulle und Nasenspray. Sie steht zuerst,
// weil Seitenverhaeltnis und Namenseinzug daraus hergeleitet werden.
export const TUBE_VIEWBOX = { x: 21, y: 6, width: 78, height: 279 } as const

// Die Quetschnaht ist die breiteste Stelle der ganzen Form. Sie hat bewusst
// keine eigene Kontur und keine gerundeten Ecken: eine gequetschte Tube ist ein
// Stück Blech, und eine Trennlinie an dieser Stelle liesse sie wie einen
// aufgesetzten Deckel wirken.
export const TUBE_CRIMP = { x: 21, y: 6, width: 78, height: 16 } as const

// Die Riffelung der Naht. Linien, keine Körper — im Markup mit fill="none".
export const TUBE_CRIMP_RIB_XS = [
  24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 68, 72, 76, 80, 84, 88, 92, 96,
] as const

// Die Verjüngung als Daten, damit sich Namenseinzug und Kantensäume daraus
// herleiten lassen statt geraten zu werden.
export const TUBE_TAPER = {
  yTop: 22, yBottom: 242,
  xTopLeft: 21, xTopRight: 99,
  xBottomLeft: 32.6, xBottomRight: 87.4,
} as const

// Durchgehende Silhouette: von den Nahtecken bis zum eingerundeten Ende, das
// bei y 254 hinter der Deckeloberkante (250) verschwindet — so wird ein Deckel
// wirklich über ein Tubenende geschoben.
export const TUBE_BODY_PATH = 'M21 6 L99 6 L99 22 L87.4 242 C 87.1 249 84.2 254 79 254 L41 254 C 35.8 254 32.9 249 32.6 242 L21 22 Z'

// Kantensäume auf der Silhouette. Sie gehören zur Form, nicht zur Beleuchtung,
// und sind die einzigen Teile, die der Verjüngung folgen müssen.
export const TUBE_SEAM_LEFT_PATH = 'M21 6 L26.5 6 L36 250 L32.6 250 Z'
export const TUBE_SEAM_RIGHT_PATH = 'M93.5 6 L99 6 L87.4 250 L84 250 Z'

// Kantenlicht auf der Rundung, darunter ein dunkler Bogen. Erst das Paar
// hell-über-dunkel liest sich als Kante; ein einzelner Strich wirkt aufgemalt.
export const TUBE_EDGE_LIGHT_PATH = 'M33.4 243.5 C 33.7 249.4, 36.4 251.9, 41.2 251.9 L78.8 251.9 C 83.6 251.9, 86.3 249.4, 86.6 243.5'
export const TUBE_EDGE_SHADOW_PATH = 'M33.1 245.4 C 33.4 250.6, 36.1 253.4, 41 253.4 L79 253.4 C 83.9 253.4, 86.6 250.6, 86.9 245.4'

// Schwarzer Klappdeckel, schmaler als das Tubenende — daraus entsteht am
// Übergang die Schulter.
export const TUBE_CAP = { x: 34.5, y: 250, width: 51, height: 35 } as const
export const TUBE_CAP_PATH = 'M34.5 250 L85.5 250 L85.5 278 C 85.5 282.5 82.5 285 77.5 285 L42.5 285 C 37.5 285 34.5 282.5 34.5 278 Z'

// Die Daumenmulde und die Fuge, die quer durch sie hindurchläuft: die Fuge ist
// die Öffnung, die Mulde der Angriffspunkt. Darunter die Lippe des unteren
// Teils, die Licht fängt — ohne sie liest sich die Fuge als aufgemalter Strich.
export const TUBE_CAP_RECESS = { cx: 60, cy: 266, rx: 12.5, ry: 7.5 } as const
export const TUBE_CAP_SEAM_Y = 267.6
export const TUBE_CAP_SEAM_LIP_Y = 268.5

// Mitte der Aufschrift auf 46 % der Objekthöhe.
export const TUBE_NAME_TOP_PCT = 0.46

// Der Einzug folgt der Verjüngung: auf Namenshöhe ist der Körper schmaler als
// die viewBox. Beim Nasenspray war der richtige Wert null, weil der Körper dort
// die volle Breite hatte — derselbe Fehler wäre hier nur andersherum.
const TUBE_NAME_Y = TUBE_VIEWBOX.y + TUBE_NAME_TOP_PCT * TUBE_VIEWBOX.height
const TUBE_NAME_T = (TUBE_NAME_Y - TUBE_TAPER.yTop) / (TUBE_TAPER.yBottom - TUBE_TAPER.yTop)
const TUBE_NAME_LEFT = TUBE_TAPER.xTopLeft + (TUBE_TAPER.xBottomLeft - TUBE_TAPER.xTopLeft) * TUBE_NAME_T
export const TUBE_NAME_INSET_PCT = (TUBE_NAME_LEFT - TUBE_VIEWBOX.x) / TUBE_VIEWBOX.width

// Oberlicht: die Lampe steht über der Bühne, die Tube daneben. Ihre Richtung
// kippt deshalb mit der Lage im Karussell, und der Glanzkern wandert zur
// beleuchteten Seite.
export const TUBE_LIGHT_MAX_DEG = 34
export const TUBE_LIGHT_CORE_SHIFT = 17

export const TUBE_ASPECT = TUBE_VIEWBOX.width / TUBE_VIEWBOX.height

export const TUBE_SPEC: StageFormSpec = {
  viewBox: TUBE_VIEWBOX,
  // Undurchsichtig, Paste statt Flüssigkeit: keine Kammer, damit weder
  // Etikettband noch Prozentzeile.
  chamber: null,
  hasMeaningfulFill: false,
}
