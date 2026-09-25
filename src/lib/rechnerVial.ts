/**
 * Ein Vial aus dem Stack fuer den Rechner: Wirkstoff pro Vial in mg und die
 * zugefuegte Fluessigkeit.
 *
 * Neu steht der Wirkstoff als Zutat mit dem Bezug „pro Vial" und die
 * Fluessigkeit im Bestand (`stack_item_inventory.reconstitution_ml`, gesetzt
 * beim Anmischen). Die Altspalten gelten nur, wo es das nicht gibt.
 */

interface Zutat {
  amount_value: number | null
  amount_unit: string | null
  basis_value: number | null
  basis_unit: string | null
}

interface Bestand {
  enabled?: boolean | null
  package_unit?: string | null
  reconstitution_ml?: number | null
}

export interface RechnerQuelle {
  id: string
  display_name: string
  vial_amount_mg: number | null
  vial_amount_unit?: string | null
  reconstitution_ml: number | null
  inventory?: Bestand | Bestand[] | null
  ingredients?: Zutat[] | null
}

export interface RechnerVial {
  id: string
  display_name: string
  vial_amount_mg: number | null
  reconstitution_ml: number | null
}

function inMg(wert: number, einheit: string | null | undefined): number | null {
  if (einheit === 'mg' || einheit == null) return wert
  if (einheit === 'mcg') return wert / 1000
  return null
}

export function rechnerVial(quelle: RechnerQuelle): RechnerVial {
  const bestand = Array.isArray(quelle.inventory) ? quelle.inventory[0] ?? null : quelle.inventory ?? null
  const zutaten = quelle.ingredients ?? []
  const proVial = zutaten.length === 1 && zutaten[0].basis_unit === 'vial'
    && zutaten[0].amount_value != null && zutaten[0].basis_value
    ? inMg(zutaten[0].amount_value / zutaten[0].basis_value, zutaten[0].amount_unit)
    : null
  const alt = quelle.vial_amount_mg != null ? inMg(quelle.vial_amount_mg, quelle.vial_amount_unit) : null
  const fluessigkeit = bestand?.enabled && bestand.package_unit === 'vial' && bestand.reconstitution_ml
    ? bestand.reconstitution_ml
    : quelle.reconstitution_ml
  return {
    id: quelle.id,
    display_name: quelle.display_name,
    vial_amount_mg: proVial ?? alt,
    reconstitution_ml: fluessigkeit,
  }
}
