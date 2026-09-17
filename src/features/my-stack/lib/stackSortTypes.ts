/** Genau die Felder, die ueber eine Sortierung entscheiden — mehr braucht es nicht. */
export interface StackItemLike {
  vials_in_stock?: number | null
  reconstitution_date?: string | null
  vial_amount_mg?: number | null
  reconstitution_ml?: number | null
  expiry_days?: number | null
}
