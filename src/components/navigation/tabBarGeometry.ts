/**
 * Die Masse der Leiste — ohne React, damit sie sich rechnen und pruefen
 * lassen, ohne etwas zu rendern.
 */

/**
 * Attribut, an dem die Messung die Plaetze im Streifen wiederfindet.
 *
 * PLAETZE, nicht Reiter: die mittlere Schaltflaeche traegt es ebenso. Sie
 * fuehrt zwar zu keiner Seite, ist aber ein Ort, ueber den der Finger gleiten
 * und auf dem er loslassen kann.
 */
export const SLOT_ATTR = 'data-tyd-slot'

/** Luft zwischen Pille und Platzkante — je Seite. */
export const PILLE_LUFT = 6
/** Damit die Pille auf einem breiten Schirm nicht ins Plumpe waechst. */
export const PILLE_MAX = 64
/**
 * Hoehe der Pille: Kapselhoehe minus zweimal Einzug (56 - 2x5 in `index.css`).
 * Hier als Zahl, weil daraus die UNTERGRENZE der Breite folgt — und eine
 * Rechnung, die nur in CSS steht, kann diese Datei nicht anstellen.
 */
export const PILLE_HOEHE = 46

/**
 * Wie breit die Pille auf einem Platz ist.
 *
 * Schmaler als der Platz, damit sie das Symbol umfasst statt das Fach
 * auszumalen — aber nie schmaler als hoch. Das ist der Punkt: die Kapsel ist
 * ein liegendes Oval, und eine STEHENDE Pille darin laeuft ihren Rundungen
 * entgegen statt mit ihnen. Unten begrenzt deshalb die eigene Hoehe (dann ist
 * sie im schlimmsten Fall kreisrund, nie hochkant), oben `PILLE_MAX`, damit
 * sie auf einem breiten Schirm nicht ins Plumpe waechst.
 */
export function pillenBreite(platzBreite: number) {
  return Math.min(PILLE_MAX, Math.max(PILLE_HOEHE, platzBreite - 2 * PILLE_LUFT))
}

/**
 * Wohin die Pille gehoert, wenn sie am Finger haengt.
 *
 * Sie sitzt mittig unter der Fingerspitze und wird an den Kapselrand geklemmt
 * — sonst haenge sie beim Wischen nach aussen halb in der Luft.
 */
export function freieLage(x: number, breite: number, kapselBreite: number) {
  const rand = PILLE_LUFT / 2
  return Math.max(rand, Math.min(kapselBreite - rand - breite, x - breite / 2))
}

/** Welcher Platz liegt bei dieser Stelle im Streifen am naechsten? */
export function platzBei<T extends { id: string; mitte: number }>(plaetze: readonly T[], x: number) {
  if (plaetze.length === 0) return null
  let naechster = plaetze[0]
  for (const eintrag of plaetze) {
    if (Math.abs(eintrag.mitte - x) < Math.abs(naechster.mitte - x)) naechster = eintrag
  }
  return naechster.id || null
}
