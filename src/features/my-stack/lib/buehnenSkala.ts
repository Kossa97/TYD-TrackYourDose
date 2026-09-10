// Wie gross ein Objekt im Auswahlkarussell steht.
//
// Die Buehnenformen bringen feste Pixelgroessen mit — eine liegende Kapsel
// ist 42 px hoch, ein Pen 237 px. In einer Reihe nebeneinander heisst das:
// die Kapsel ist kaum zu erkennen, egal wie viel Platz die Reihe hat. Eine
// hoehere Reihe machte die Objekte vorher kein Stueck groesser, sie vergroesserte
// nur die Leere darueber.

// Wie stark der Groessenunterschied zwischen den Formen zusammengezogen wird.
// 1 waere der echte Maßstab (Kapsel neben Pen — kaum zu erkennen), 0 machte
// alle gleich gross und naehme dem Pen die wahre Aussage, dass er das
// groessere Ding ist. Die Wurzel dazwischen laesst die Reihenfolge stehen und
// hebt die kleinen Formen an.
export const MASSSTAB_LOCKERUNG = 0.35

// Wie viel des Standplatzes das groesste Objekt einnimmt. Der Rest ist Luft,
// damit nichts an der Ueberschrift der naechsten Reihe klebt.
export const BUEHNEN_DECKUNG = 0.9

export interface BuehnenMasse {
  /** Native Hoehe des Objekts, ohne Skalierung. */
  hoehe: number
  /** Native Breite des Objekts, ohne Skalierung. */
  breite: number
  /** Native Hoehe des groessten Objekts derselben Reihe. */
  groessteHoehe: number
  /** Hoehe der Reihe. */
  platzHoehe: number
  /** Breite eines Standplatzes in dieser Reihe. */
  platzBreite: number
}

export function buehnenSkala({
  hoehe,
  breite,
  groessteHoehe,
  platzHoehe,
  platzBreite,
}: BuehnenMasse): number {
  if (hoehe <= 0 || breite <= 0 || groessteHoehe <= 0) return 1

  const anteil = Math.pow(hoehe / groessteHoehe, MASSSTAB_LOCKERUNG)
  const nachHoehe = (platzHoehe * BUEHNEN_DECKUNG * anteil) / hoehe
  // Die Breite begrenzt mit: eine liegende Kapsel ist flach und 140 px breit.
  // Nur nach der Hoehe skaliert waere sie dreimal so breit wie ihr Standplatz
  // und laege ueber ihren Nachbarn.
  const nachBreite = (platzBreite * BUEHNEN_DECKUNG) / breite
  return Math.min(nachHoehe, nachBreite)
}
