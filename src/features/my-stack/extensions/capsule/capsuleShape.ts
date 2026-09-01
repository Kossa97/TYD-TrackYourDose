import type { StageFormSpec } from '../../stage/types'

// Zweiteilige Hartkapsel, liegend. Der Grundkörper läuft über die volle Länge;
// die Kappe liegt als zusätzliche Schicht darüber. Nur so bleibt die Naht am
// Kappenrand die einzige sichtbare innere Linie — ein an die Kappe anstoßender
// Körper zeigt seine harte Kante durch die durchsichtige Hülle.
export const CAPSULE_SHELL_PATH = 'M42 8 L198 8 C217 8 232 23 232 42 C232 61 217 76 198 76 L42 76 C23 76 8 61 8 42 C8 23 23 8 42 8 Z'
export const CAPSULE_SHELL_INNER_PATH = 'M44 11.5 L198 11.5 C215 11.5 228.5 25 228.5 42 C228.5 59 215 72.5 198 72.5 L44 72.5 C27 72.5 11.5 59 11.5 42 C11.5 25 27 11.5 44 11.5 Z'

// Die Kappe ist minimal höher als der Körper — sie schiebt sich im echten
// Bauteil darüber.
export const CAPSULE_SEAM_X = 130
export const CAPSULE_CAP_PATH = 'M130 4 L42 4 C21 4 4 21 4 42 C4 63 21 80 42 80 L130 80 Z'
export const CAPSULE_CAP_INNER_PATH = 'M127 7.5 L42 7.5 C23 7.5 7.5 23 7.5 42 C7.5 61 23 76.5 42 76.5 L127 76.5 Z'

export const CAPSULE_VIEWBOX = { x: 0, y: 0, width: 240, height: 84 } as const
// Höhe geteilt durch Breite. Die Kapsel skaliert uniform, nie gestaucht.
export const CAPSULE_ASPECT = 84 / 240

export const CAPSULE_SPEC: StageFormSpec = {
  viewBox: CAPSULE_VIEWBOX,
  // Keine Flüssigkeit: damit kein Etikett und kein Füllstand.
  chamber: null,
  hasMeaningfulFill: false,
}
