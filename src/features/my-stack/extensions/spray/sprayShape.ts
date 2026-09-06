import type { StageFormSpec } from '../../stage/types'

// Das Mundspray. Gezeichnet auf demselben 120er Raster wie die anderen
// stehenden Formen, die viewBox unten auf die Objektgrenzen beschnitten.
// Aufbau von oben nach unten: Druckkopf mit seitlicher Duese, geriffelter
// Kragen, Hals, Glaskoerper.
//
// Warum es NICHT wie das Nasenspray aussehen darf: beide sind Pumpflaschen,
// und wenn sie sich nur in der Groesse unterscheiden, ist eine von beiden
// ueberfluessig. Die Unterschiede sind deshalb bewusst gesetzt und jeder
// einzelne stimmt am echten Objekt:
//
//   Nasenspray                     Mundspray
//   kegelige Duese nach OBEN       Duese SEITLICH, man spruehz in die Wange
//   breite Fingerauflage           schmaler Druckkopf, mit dem Daumen bedient
//   Koerper 78 breit               Koerper 60 breit, eine Sprosse kleiner
//   weisser PP-Kopf                Kopf in der Eintragsfarbe
//   kein Steigrohr gezeichnet      Steigrohr sichtbar im Glas
//
// Die seitliche Duese ist das Erkennungsmerkmal, wie die Einschnuerung bei der
// Ampulle und die Bruchrille bei der Tablette.

export const SPRAY_VIEWBOX = { x: 23, y: 72, width: 74, height: 220 } as const

// Die Form skaliert uniform, also legt das viewBox-Verhaeltnis die Breite fest.
export const SPRAY_ASPECT = SPRAY_VIEWBOX.width / SPRAY_VIEWBOX.height

// Der Druckkopf. Schmal genug, dass ein Daumen ihn abdeckt — genau so wird er
// bedient, und genau das unterscheidet ihn von der zweifingrigen Auflage des
// Nasensprays.
export const SPRAY_ACTUATOR = { x: 40, y: 72, width: 40, height: 24, rx: 4 } as const

// Die Griffrille auf der Druckflaeche. Eine Linie, kein Koerper — also
// zwingend fill="none".
export const SPRAY_ACTUATOR_RIDGE_PATH = 'M45 79 L75 79'

// Die seitliche Duese. Sie steht nach rechts aus dem Kopf heraus; deshalb ist
// die viewBox nach rechts breiter als das Glas es braeuchte, damit die Flasche
// trotzdem mittig im Rahmen steht.
// Sie beginnt UNTER dem Druckkopf, nicht an dessen Kante: der Kopf ist oben
// gerundet, und eine Duese, die genau an der Rundung ansetzt, laesst einen
// keilfoermigen Spalt stehen und sieht angeklebt aus. Der Kopf wird nach der
// Duese gezeichnet und deckt die Ueberlappung ab.
export const SPRAY_NOZZLE = { x: 74, y: 78, width: 21, height: 10, rx: 2.5 } as const
export const SPRAY_NOZZLE_MOUTH = { cx: 93.2, cy: 83, r: 1.6 } as const

// Schraubkragen. Stoesst oben lueckenlos an den Kopf; eine Luecke zeigte sich
// beim Nasenspray als heller Spalt.
export const SPRAY_COLLAR = { x: 44, y: 96, width: 32, height: 18 } as const
export const SPRAY_COLLAR_RIB_YS = { top: 100, bottom: 110 } as const
const RIB_FIRST = 46.5
const RIB_STEP = 2.6
const RIB_COUNT = 11
export const SPRAY_COLLAR_RIB_XS = Array.from(
  { length: RIB_COUNT },
  (_, i) => Number((RIB_FIRST + i * RIB_STEP).toFixed(2)),
)

// Der Rand, an dem der Kragen auf den Hals aufsetzt.
export const SPRAY_COLLAR_GROOVE_PATH = 'M45 112.5 L75 112.5'

// Glas: Hals, Schulter, Koerper, gerundeter Boden. Der Hals beginnt unter dem
// Kragen, damit dort keine Fuge aufgehen kann.
export const SPRAY_OUTER_PATH =
  'M50 108 L70 108 L70 126 C 78 130, 90 136, 90 152 L90 278 C 90 287, 84 292, 74 292 L46 292 C 36 292, 30 287, 30 278 L30 152 C 30 136, 42 130, 50 126 Z'

// Die nach innen versetzte Kontur zeichnet die Wandstaerke — die doppelte
// Linie, die einen hohlen Koerper von einer Silhouette unterscheidet — und sie
// beschneidet die Fluessigkeit, damit ein Glasboden darunter sichtbar bleibt.
export const SPRAY_INNER_PATH =
  'M52.5 111 L67.5 111 L67.5 127.5 C 75 131.5, 87 137.5, 87 153.5 L87 277 C 87 284.5, 82 288.5, 73.5 288.5 L46.5 288.5 C 38 288.5, 33 284.5, 33 277 L33 153.5 C 33 137.5, 45 131.5, 52.5 127.5 Z'

export const SPRAY_WIDTHS = { body: 60, collar: 32, actuator: 40, neck: 20 } as const

// Wandstaerke 3 Einheiten auf 60 Koerperbreite: dieselben 5 %, die Vial,
// Ampulle und Tropfflasche benutzen.
export const SPRAY_WALL = 3

// Das Steigrohr. Es haengt am Kopf und reicht bis kurz ueber den Boden — ohne
// das Rohr gaebe es keinen Weg, wie die Fluessigkeit nach oben kaeme, und die
// Pumpe waere Dekoration.
export const SPRAY_DIP_TUBE = { x: 58.4, width: 3.2, top: 112, bottom: 284 } as const

// Etwas weniger voll als das Nasenspray (0,94): erst dadurch steht das
// Steigrohr ein Stueck frei im Kopfraum und ist als Rohr zu erkennen. Tiefer
// als das hier sah die Flasche halb leer aus — bei hasMeaningfulFill: false
// waere das eine Behauptung ueber einen Stand, den die App nicht kennt.
export const SPRAY_FILL = 0.88

// Der gerade Teil des Innenraums. Das haelt die Kammer rechteckig, so braucht
// die Geometrie kein Breitenprofil fuer die Schulter — derselbe Kunstgriff,
// den Vial, Ampulle und Nasenspray schon benutzen.
export const SPRAY_CHAMBER = { x: 33, y: 155, width: 54, height: 133, aspect: 54 / 133 } as const

// Wo der Pegel bei SPRAY_FILL steht. Abgeleitet statt getippt, damit Etikett
// und Pegel nicht auseinanderlaufen koennen.
export const SPRAY_SURFACE_Y = SPRAY_CHAMBER.y + SPRAY_CHAMBER.height * (1 - SPRAY_FILL)

// Anteilige Etikettlage, damit Karussell und Detailansicht dasselbe Verhaeltnis
// halten: y 205 bis 243 auf dem Zeichenraster. Der Inhalt bleibt oberhalb UND
// unterhalb sichtbar — dieselbe Regel, die beim Gel aufgestellt wurde.
export const SPRAY_LABEL = { top: 205, bottom: 243 } as const
export const SPRAY_LABEL_TOP_PCT = (SPRAY_LABEL.top - SPRAY_VIEWBOX.y) / SPRAY_VIEWBOX.height
export const SPRAY_LABEL_HEIGHT_PCT = (SPRAY_LABEL.bottom - SPRAY_LABEL.top) / SPRAY_VIEWBOX.height

// Das Band sitzt auf dem Glas, nicht auf dem Rahmen. Die viewBox ist wegen der
// seitlichen Duese breiter als die Flasche; ohne diesen Einzug staende das Band
// links und rechts ueber den Flaschenrand hinaus in die Luft.
const SPRAY_BODY_X = 30
export const SPRAY_LABEL_INSET_PCT = (SPRAY_BODY_X - SPRAY_VIEWBOX.x) / SPRAY_VIEWBOX.width

// Wege der Buehnenlichter, in viewBox-Einheiten. Positiver Versatz heisst
// Lampe rechts: Schatten nach links, Glanz nach rechts.
export const SPRAY_GROUND_SHIFT = 6
export const SPRAY_SHEEN_SHIFT = 18
export const SPRAY_BLOOM_SHIFT = 12
export const SPRAY_HEAD_LIGHT_SHIFT = 8

export const SPRAY_SPEC: StageFormSpec = {
  viewBox: SPRAY_VIEWBOX,
  chamber: SPRAY_CHAMBER,
  // Wie beim Nasenspray: die App kennt den Stand der offenen Flasche nicht.
  // Die Grafik zeigt das Objekt, eine Prozentzahl waere eine Behauptung.
  hasMeaningfulFill: false,
}
