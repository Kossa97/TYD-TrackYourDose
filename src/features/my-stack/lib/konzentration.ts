// Was in einem Milliliter steckt.
//
// Der Staerke-Schritt erfasst zwei Zahlen: Wirkstoffmenge und Produktmenge.
// Bei allem, was in Millilitern gemessen wird, ist die INTERESSANTE Zahl aber
// eine dritte — die Konzentration. „10 mg pro 2 ml" sagt niemandem, was in
// der Spritze landet; „5 mg/ml" schon.
//
// Deshalb rechnet diese Funktion sie aus und der Schritt schreibt sie hin.
// Gespeichert wird sie nicht: sie steckt bereits in den beiden Zahlen, und
// eine zweite Quelle fuer dieselbe Tatsache ist eine Quelle zu viel.

export interface Konzentration {
  readonly value: number
  readonly unit: string
}

// Einheiten, die sich sinnvoll auf ein Volumen beziehen lassen. „ml pro ml"
// waere keine Konzentration, sondern eine Tautologie.
const WIRKSTOFF_EINHEITEN = ['mcg', 'mg', 'g', 'IU']

/**
 * Gibt die Menge je Milliliter zurueck — oder `null`, wenn die Angabe keine
 * Konzentration hergibt oder die Rechnung nichts Neues zeigt (Produktmenge 1
 * ist die Zeile selbst).
 */
export function konzentrationProMl(
  amountValue: number | null,
  amountUnit: string | null,
  basisValue: number | null,
  basisUnit: string | null,
): Konzentration | null {
  if (basisUnit?.trim() !== 'ml') return null
  if (amountValue == null || !Number.isFinite(amountValue) || amountValue <= 0) return null
  if (basisValue == null || !Number.isFinite(basisValue) || basisValue <= 0) return null
  if (basisValue === 1) return null

  const einheit = amountUnit?.trim() ?? ''
  if (!WIRKSTOFF_EINHEITEN.includes(einheit)) return null

  return { value: runden(amountValue / basisValue), unit: einheit }
}

// Drei Nachkommastellen reichen: 10 mg auf 3 ml sind 3,333 mg/ml, und die
// vierte Stelle beschreibt keine Menge, die jemand aufziehen kann. Nullen am
// Ende fallen weg, damit aus 5,000 wieder 5 wird.
function runden(wert: number): number {
  return Number(wert.toFixed(3))
}
