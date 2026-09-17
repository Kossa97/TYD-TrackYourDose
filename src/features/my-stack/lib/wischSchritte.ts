/**
 * Wie viele Standplaetze ein Wisch wert ist.
 *
 * Das native Ausrollen hat zwei Wuensche vermischt: „einen weiter" und „ein
 * Stueck weit weg". Ein kurzer Stups trug den Streifen ueber drei, vier
 * Objekte, weil der Browser den Schwung fortsetzt, bis die Reibung ihn
 * aufbraucht — die Fingerstrecke zaehlt dabei gar nicht mit.
 *
 * Hier zaehlt sie. Die Regel in einem Satz: **ein kurzer Wisch ist genau ein
 * Schritt, ein langer so viele, wie der Finger getragen hat — plus dem, was
 * sein Schwung noch weiter traegt.**
 */

/** Ab hier gilt ein Wisch als „getragen" statt „gestupst": ein halber Schritt. */
export const KURZ_ANTEIL = 0.5
/** Ab diesem Tempo (px/ms) ist ein kurzer Wisch ein Stups und kein Zittern. */
export const STUPS_TEMPO = 0.25
/**
 * Wie lange der Schwung nach dem Loslassen noch traegt. Kein Messwert, sondern
 * die Stellschraube fuer „wie weit fliegt ein kraeftiger Wisch": 120 ms
 * bedeuten bei 1 px/ms rund einen halben Schritt obendrauf.
 */
export const SCHWUNG_MS = 120

export interface Wisch {
  /** Fingerstrecke in px. Nach links ist negativ. */
  strecke: number
  /** Tempo beim Loslassen in px/ms. Nach links ist negativ. */
  tempo: number
  /** Abstand zweier Standplaetze: Breite eines Eintrags plus Luecke. */
  schrittweite: number
}

/**
 * Vorzeichen: der Streifen laeuft dem Finger entgegen. Wer nach links wischt
 * (negative Strecke), will den naechsten Eintrag — also ein Schritt vorwaerts.
 */
export function wischSchritte({ strecke, tempo, schrittweite }: Wisch): number {
  if (!Number.isFinite(schrittweite) || schrittweite <= 0) return 0

  const kurz = Math.abs(strecke) < KURZ_ANTEIL * schrittweite
  if (kurz) {
    // Ein Stups ist genau ein Schritt — egal wie kraeftig. Genau das war der
    // Aerger: ein kurzer, schneller Wisch soll einen weiter, nicht vier.
    if (Math.abs(tempo) < STUPS_TEMPO) return 0
    return tempo < 0 ? 1 : -1
  }

  const getragen = -strecke / schrittweite
  const schwung = (-tempo * SCHWUNG_MS) / schrittweite
  const schritte = Math.round(getragen + schwung)
  // Wer ueber einen halben Schritt gezogen hat, will mindestens einen — sonst
  // federt der Streifen dorthin zurueck, wo er herkam.
  if (schritte === 0) return strecke < 0 ? 1 : -1
  return schritte
}
