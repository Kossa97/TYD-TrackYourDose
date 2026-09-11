// Wie gross ein einzelnes Objekt in einer festen Flaeche steht, ohne seine
// eigenen Proportionen zu verlieren — dasselbe Prinzip wie CSS
// `object-fit: contain`, nur fuer ein Objekt mit fester Pixelgroesse statt
// eines Bildes.
//
// Anders als `buehnenSkala` (die mehrere Formen NEBENEINANDER lockert, damit
// eine Kapsel neben einem Pen nicht winzig wirkt) steht hier immer nur ein
// Objekt allein in seiner Flaeche — es darf sie ganz ausfuellen. Kein
// Lockerungsexponent, keine Nachbarn: nur die Seite, die knapper ist,
// begrenzt die Skala.

// Wie viel der Flaeche das Objekt einnimmt. Etwas Luft, damit es nicht genau
// an der Kante klebt.
export const OBJEKT_DECKUNG = 0.94

export interface ObjektMasse {
  /** Native Hoehe des Objekts, ohne Skalierung. */
  hoehe: number
  /** Native Breite des Objekts, ohne Skalierung. */
  breite: number
  /** Hoehe der verfuegbaren Flaeche. */
  platzHoehe: number
  /** Breite der verfuegbaren Flaeche. */
  platzBreite: number
}

export function objektSkala({ hoehe, breite, platzHoehe, platzBreite }: ObjektMasse): number {
  if (hoehe <= 0 || breite <= 0 || platzHoehe <= 0 || platzBreite <= 0) return 1

  const nachHoehe = (platzHoehe * OBJEKT_DECKUNG) / hoehe
  const nachBreite = (platzBreite * OBJEKT_DECKUNG) / breite
  // Die knappere Seite gewinnt: ein hohes, schmales Objekt (Pen) wird von der
  // Hoehe begrenzt, ein flaches, breites (liegende Kapsel) von der Breite.
  return Math.min(nachHoehe, nachBreite)
}
