export interface PkProfileOption {
  id: string
  name: string
  aliases: string[]
}

export interface PeptideForm {
  inventory_item_id: string
  pk_profile_id: string
  name: string
  default_method: string
  vial_amount_mg: string
  vial_amount_unit: string
  reconstitution_ml: string
  syringe_ml: string
  syringe_units: string
  notes: string
  vials_in_stock: string
  reconstitution_date: string
  expiry_days: string
  batch_number: string
  batch_source: string
  batch_file_url: string
  color_hex: string
}

export const emptyPeptideForm = (): PeptideForm => ({
  inventory_item_id: '',
  pk_profile_id: '',
  name: '',
  default_method: '',
  vial_amount_mg: '',
  vial_amount_unit: 'mg',
  reconstitution_ml: '',
  syringe_ml: '1',
  syringe_units: '100',
  notes: '',
  vials_in_stock: '',
  reconstitution_date: '',
  expiry_days: '',
  batch_number: '',
  batch_source: '',
  batch_file_url: '',
  color_hex: '',
})
