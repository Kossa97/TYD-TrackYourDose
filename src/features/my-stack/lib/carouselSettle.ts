/**
 * Wohin das Karussell rollen muss, damit ein Eintrag mittig steht.
 *
 * Bis hierher hat das der Browser gemacht: `scroll-snap-type: x mandatory`
 * plus `scroll-snap-align: center`. Auf dem Geraet war zu sehen, dass er es
 * ZU SPAET macht — in einer Bildschirmaufnahme dreimal dasselbe Muster: der
 * Wisch laeuft aus, das Objekt steht 25 bis 33 px neben der Mitte still, haelt
 * dort 220 bis 300 ms, und springt dann in einem einzigen Bild auf die Mitte.
 * Ein Ruck, kein Gleiten.
 *
 * Das Einrasten gehoert deshalb uns. Diese Rechnung ist der Kern davon: aus
 * dem Kasten des Eintrags und der Breite des Streifens folgt genau eine
 * Zielposition, und die wird angefahren, sobald das Rollen zur Ruhe kommt.
 * Kein Browser entscheidet mehr mit, also kann auch keiner nachkorrigieren.
 */
export interface StreifenMasse {
  /** Linke Kante des Eintrags im Streifen (`offsetLeft`). */
  itemLeft: number
  itemWidth: number
  /** Sichtbare Breite des Streifens (`clientWidth`). */
  clientWidth: number
  /** Gesamtbreite des Inhalts (`scrollWidth`). */
  scrollWidth: number
}

/**
 * Am Anfang und am Ende reicht der Platz nicht, um den Eintrag wirklich in die
 * Mitte zu holen — dort wird geklemmt. Das ist kein Sonderfall, sondern
 * dieselbe Rechnung mit Rand.
 */
export function zentrierPosition({ itemLeft, itemWidth, clientWidth, scrollWidth }: StreifenMasse) {
  const ziel = itemLeft + itemWidth / 2 - clientWidth / 2
  const groesstes = Math.max(0, scrollWidth - clientWidth)
  return Math.max(0, Math.min(groesstes, ziel))
}

/**
 * Lohnt sich das Nachfahren ueberhaupt?
 *
 * Unterhalb eines Bildpunkts sieht es niemand, und ein Rollbefehl auf die
 * Stelle, an der man schon steht, kostet auf iOS trotzdem ein Ruckeln.
 */
export const EINRASTEN_SCHWELLE_PX = 1

export function mussEinrasten(scrollLeft: number, ziel: number) {
  return Math.abs(scrollLeft - ziel) >= EINRASTEN_SCHWELLE_PX
}
