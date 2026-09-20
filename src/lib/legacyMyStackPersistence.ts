export interface LegacyPeptidePayload {
  name: string
  default_unit: string
  default_dose: number | null
  default_method: string
  vial_amount_mg: number | null
  vial_amount_unit: string | null
  reconstitution_ml: number | null
  syringe_type: string | null
  notes: string | null
  vials_in_stock: number
  vials_initial: number
  reconstitution_date: string | null
  expiry_days: number | null
  batch_number: string | null
  batch_source: string | null
  batch_file_url: string | null
  inventory_item_id: string | null
  pk_profile_id: string | null
}

interface StackItemRpcPayload {
  p_item: {
    id: string | null
    display_name: string
    category: 'peptide'
    dosage_form: 'vial'
    brand: null
    color_hex: string | null
    notes: string | null
  }
  p_ingredients: [{
    catalog_substance_id: null
    custom_name: string
    amount_value: number | null
    amount_unit: string | null
    basis_value: 1
    basis_unit: 'vial'
    position: 0
  }]
}

type LegacyTrackingPayload = Omit<LegacyPeptidePayload, 'name'>

export interface LegacyStackItemSave {
  rpc: StackItemRpcPayload
  tracking: LegacyTrackingPayload
}

const nullableText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function buildLegacyStackItemSave(
  payload: LegacyPeptidePayload,
  id: string | null,
  colorHex: string,
): LegacyStackItemSave {
  const { name, ...tracking } = payload
  const displayName = name.trim()

  return {
    rpc: {
      p_item: {
        id,
        display_name: displayName,
        category: 'peptide',
        dosage_form: 'vial',
        brand: null,
        color_hex: nullableText(colorHex),
        notes: payload.notes,
      },
      p_ingredients: [{
        catalog_substance_id: null,
        custom_name: displayName,
        amount_value: payload.vial_amount_mg,
        amount_unit: payload.vial_amount_mg === null
          ? null
          : nullableText(payload.vial_amount_unit),
        basis_value: 1,
        basis_unit: 'vial',
        position: 0,
      }],
    },
    tracking,
  }
}

export function toLegacyPeptideRow<T extends { display_name: string }>(
  row: T,
): T & { name: string } {
  return { ...row, name: row.display_name }
}
