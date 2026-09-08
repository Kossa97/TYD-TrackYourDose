import type { TrackingLevel } from '../types'

// Was eine Tracking-Stufe erfasst — und zwar hier und nur hier. Wer wissen
// will, ob eine Stufe etwas kann, fragt diese Tabelle; niemand vergleicht die
// Stufe selbst mit einem Namen. Die Regel stand einmal an vier Stellen
// (hier, in dosePlan, in stackInventory und in der Schrittliste des
// Formulars), und zwei davon leiteten sie eigenstaendig ab. Vier Orte fuer
// eine Regel heisst: irgendwann sagt einer etwas anderes.
//
// Der Bestand steht bewusst NICHT in dieser Tabelle. Ob jemand Vorraete
// fuehrt, ist keine Frage der Messgenauigkeit — wer nur „genommen“ abhakt,
// will trotzdem wissen, wann die Packung leer ist. Der Bestand hat seinen
// eigenen Schalter im Entwurf und gilt auf jeder Stufe.
export interface TrackingCapabilities {
  /** Menge je Einnahme. */
  quantity: boolean
  /** Dosisanpassung ueber die Zeit (Titration, Eskalation). */
  titration: boolean
  /** Wirkstoff je Einheit — die Angabe, aus der die PK-Kurve rechnet. */
  productStrength: boolean
  /** PK-Auswertung. Braucht productStrength und ein verknuepftes Profil. */
  pk: boolean
}

const CAPABILITIES: Record<TrackingLevel, TrackingCapabilities> = {
  intake_only: {
    quantity: false,
    titration: false,
    productStrength: false,
    pk: false,
  },
  with_amount: {
    quantity: true,
    titration: true,
    productStrength: false,
    pk: false,
  },
  complete: {
    quantity: true,
    titration: true,
    productStrength: true,
    pk: true,
  },
}

export function trackingCapabilities(level: TrackingLevel): TrackingCapabilities {
  return CAPABILITIES[level]
}
