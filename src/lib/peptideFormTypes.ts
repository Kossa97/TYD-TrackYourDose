export interface PkProfileOption {
  id: string
  name: string
  aliases: string[]
}

export interface PeptideForm {
  inventory_item_id: string
  pk_profile_id: string
  name: string
  default_unit: string
  default_dose: string
  default_method: string
  vial_amount_mg: string
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
  default_unit: 'mcg',
  default_dose: '',
  default_method: 'Subkutan',
  vial_amount_mg: '',
  reconstitution_ml: '2',
  syringe_ml: '1',
  syringe_units: '100',
  notes: '',
  vials_in_stock: '0',
  reconstitution_date: '',
  expiry_days: '28',
  batch_number: '',
  batch_source: '',
  batch_file_url: '',
  color_hex: '',
})
