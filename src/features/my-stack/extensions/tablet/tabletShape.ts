import type { StageFormSpec } from '../../stage/types'

// Quadratischer Kasten, damit der Kreis bei jeder Skalierung rund bleibt.
export const TABLET_VIEWBOX = { x: 0, y: 0, width: 100, height: 100 } as const

// Der Kreis füllt den Kasten fast vollständig; der Rest ist Luft für den
// Bodenschatten, der mit overflow-visible darunter gezeichnet wird.
export const TABLET_BODY = { cx: 50, cy: 50, r: 48 } as const

// Waagerecht auf der Mittellinie, über nahezu den vollen Durchmesser. Die
// Rille ist der sichtbare Ausdruck von `divisible` und das einzige Merkmal,
// das eine Tablette von einem Dragée unterscheidet.
export const TABLET_SCORE = { x1: 6, x2: 94, y: 50 } as const

// Mitte des Namens auf 62 % der Höhe — ein Viertel Radius unter der Rille.
// Dort ist die Sehne breit genug und der Abstand zur Rille sichtbar.
export const TABLET_NAME_TOP_PCT = 0.62

// Derselbe Kreis in objektbezogenen Einheiten (0…1). Nur so kann er die
// HTML-Beschriftung beschneiden — CSS clip-path kennt die viewBox nicht.
export const TABLET_BODY_NORMALIZED = { cx: 0.5, cy: 0.5, r: 0.48 } as const

// Halbe Sehne auf Namenshoehe: so weit reicht der Kreis dort nach aussen.
// Der Name laeuft bis dorthin, statt an einem pauschalen Rand zu enden — die
// Kontur schneidet die Enden und formt den Durchlauf.
const TABLET_NAME_HALF_CHORD = Math.sqrt(
  TABLET_BODY_NORMALIZED.r ** 2 - (TABLET_NAME_TOP_PCT - TABLET_BODY_NORMALIZED.cy) ** 2,
)
export const TABLET_NAME_INSET_PCT = TABLET_BODY_NORMALIZED.cx - TABLET_NAME_HALF_CHORD

export const TABLET_SPEC: StageFormSpec = {
  viewBox: TABLET_VIEWBOX,
  // Kein Innenraum, keine Flüssigkeit: damit kein Etikett und kein Füllstand.
  chamber: null,
  hasMeaningfulFill: false,
}
