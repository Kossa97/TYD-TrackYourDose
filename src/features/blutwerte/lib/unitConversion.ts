/**
 * Umrechnung zwischen Masse-Konzentrationseinheiten über reine Faktoren.
 * Basis: ng/mL (= µg/L). Ein Faktor gibt an, wie viele ng/mL 1 Einheit entspricht.
 *
 * Molare Einheiten (nmol/L, pmol/L, …) sind bewusst NICHT enthalten: ihre
 * Umrechnung hängt vom Molekulargewicht des jeweiligen Stoffs ab. Ohne dieses
 * Wissen wird nicht geraten — convert() gibt dann null zurück.
 */
const MASS_FACTORS: Record<string, number> = {
  'g/dl': 1e7,
  'g/l': 1e6,
  'mg/dl': 1e4,
  'mg/l': 1e3,
  'µg/dl': 10,
  'µg/ml': 1e3,
  'ng/ml': 1,
  'µg/l': 1,
  'ng/dl': 0.01,
  'ng/l': 1e-3,
  'pg/ml': 1e-3,
  'pg/dl': 1e-5,
}

/** Normalisiert eine Einheit für den Vergleich: klein, ohne Leerzeichen, µ/mc/u vereinheitlicht. */
export function normalizeUnitString(unit: string): string {
  return unit
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/^mc/, 'µ')      // mcg -> µg
    .replace(/^u(?=g\/)/, 'µ') // ug/... -> µg/...  (nur als Mikro-Präfix vor g/)
}

export function canConvert(from: string, to: string): boolean {
  const a = normalizeUnitString(from)
  const b = normalizeUnitString(to)
  if (a === b) return true
  return a in MASS_FACTORS && b in MASS_FACTORS
}

/**
 * Rechnet value von der Einheit `from` in die Einheit `to` um.
 * Gibt null zurück, wenn die Einheiten nicht sicher (faktorbasiert) umrechenbar
 * sind — etwa bei molaren oder unbekannten Einheiten.
 */
export function convert(value: number, from: string, to: string): number | null {
  if (!Number.isFinite(value)) return null
  const a = normalizeUnitString(from)
  const b = normalizeUnitString(to)
  if (a === b) return value
  const fa = MASS_FACTORS[a]
  const fb = MASS_FACTORS[b]
  if (fa === undefined || fb === undefined) return null
  return (value * fa) / fb
}
