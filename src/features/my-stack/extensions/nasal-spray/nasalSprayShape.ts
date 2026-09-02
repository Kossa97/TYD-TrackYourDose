import type { StageFormSpec } from '../../stage/types'

// Gezeichnet auf einem Raster von 120 x 294 Einheiten; die viewBox unten ist
// auf die Objektgrenzen beschnitten, wie bei der Ampulle. Aufbau von oben nach
// unten: Düse, Fingerauflage, Schraubkragen, Glaskörper.

// Verjüngte Düse mit gerundeter Spitze. Sie ist das Merkmal, an dem die Form
// als Nasenspray erkannt wird — dasselbe, was die Einschnürung für die Ampulle
// und die Bruchrille für die Tablette leistet.
export const NASAL_SPRAY_NOZZLE_PATH = 'M45.5 75.5 L74.5 75.5 L69.5 14 C 69.5 9 67 6 60 6 C 53 6 50.5 9 50.5 14 Z'

// Die dünne breite Scheibe, an der zwei Finger angreifen. Sie ist breiter als
// der Kragen und damit das zweite unverwechselbare Merkmal.
export const NASAL_SPRAY_FLANGE = { x: 22, y: 75.5, width: 76, height: 12, rx: 5 } as const

// Schraubkragen. Stößt oben lückenlos an die Auflage; eine Lücke zeigte sich
// bei `large` als heller Spalt.
export const NASAL_SPRAY_COLLAR = { x: 33, y: 87.5, width: 54, height: 53 } as const
export const NASAL_SPRAY_COLLAR_PATH = 'M33 87.5 L87 87.5 L87 138 C 87 139.6 86 140.5 84 140.5 L36 140.5 C 34 140.5 33 139.6 33 138 Z'

// Umlaufende Rille am Kragen. Eine Linie, kein Körper — deshalb zwingend
// fill="none", sonst füllt sie schwarz.
export const NASAL_SPRAY_COLLAR_GROOVE_PATH = 'M35 128 L85 128'

// Glaskörper, 78 Einheiten breit. Das ist die Untergrenze: die Fingerauflage
// misst 76 und stünde bei schmalerem Glas über den Flaschenrand hinaus.
export const NASAL_SPRAY_BODY_PATH = 'M21 156 C 21 146 25 141 33 140.5 L87 140.5 C 95 141 99 146 99 156 L99 280 C 99 289 93 294 83 294 L37 294 C 27 294 21 289 21 280 Z'

// Die nach innen versetzte Kontur. Sie zeichnet die Wandstärke — die doppelte
// Linie, die einen hohlen Körper von einer Silhouette unterscheidet — und sie
// beschneidet die Flüssigkeit, damit ein Glasboden darunter sichtbar bleibt.
export const NASAL_SPRAY_BODY_INNER_PATH = 'M24 157 C 24 148.5 27.5 144 34.5 143.5 L85.5 143.5 C 92.5 144 96 148.5 96 157 L96 279 C 96 286.5 91 291 82 291 L38 291 C 29 291 24 286.5 24 279 Z'

// Fast randvoll, wie in der Vorlage — aber nie ganz: der Kopfraum gibt der
// Oberfläche den Platz, den sie zum Schwappen braucht.
export const NASAL_SPRAY_FILL = 0.94

// Anteilige Etikettlage, damit Karussell und Detailansicht dasselbe Verhältnis
// halten: y 196 bis 242 auf dem Zeichenraster.
export const NASAL_SPRAY_LABEL = { topPct: 0.660, heightPct: 0.160 } as const

// Die Form skaliert uniform, also legt das viewBox-Verhältnis die Breite fest.
export const NASAL_SPRAY_ASPECT = 78 / 288

export const NASAL_SPRAY_SPEC: StageFormSpec = {
  viewBox: { x: 21, y: 6, width: 78, height: 288 },
  // Nur der gerade Teil des Innenraums. Das hält die Kammer rechteckig, so
  // braucht die Geometrie kein Breitenprofil für die Schulter — derselbe
  // Kunstgriff, den Vial und Ampulle schon benutzen.
  chamber: { x: 24, y: 157, width: 72, height: 134, aspect: 72 / 134 },
  // Die App kennt den Stand der offenen Flasche nicht: getVialFillPct liest
  // vials_in_stock, ein vial-spezifisches Altfeld. Die Grafik zeigt das
  // Objekt, eine Prozentzahl wäre eine Behauptung.
  hasMeaningfulFill: false,
}
