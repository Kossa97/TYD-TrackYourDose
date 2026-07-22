import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const source = () => readFileSync(new URL('./VialTrackingEditor.tsx', import.meta.url), 'utf8')

describe('VialTrackingEditor', () => {
  test('keeps the complete vial-specific tracking boundary in the peptide extension', () => {
    const text = source()

    for (const field of [
      'inventory_item_id', 'pk_profile_id', 'default_method', 'vial_amount_mg',
      'vial_amount_unit', 'reconstitution_ml', 'syringe_ml', 'syringe_units',
      'notes', 'vials_in_stock', 'reconstitution_date', 'expiry_days',
      'batch_number', 'batch_source', 'batch_file_url', 'color_hex',
    ]) {
      expect(text).toContain(field)
    }
    expect(text).toContain('export interface VialTrackingDraft')
    expect(text).toContain('export const emptyVialTrackingDraft')
    expect(text).toContain('PeptideVialVisual')
    expect(text).toContain('STACK_ITEM_COLORS')
  })

  test('preserves the full-height mobile tracking sheets', () => {
    const text = source()

    expect(text).toContain('h-[100dvh]')
    expect(text).toContain('sm:h-auto')
    expect(text).toContain('rounded-none')
    expect(text).toContain('pt-[env(safe-area-inset-top)]')
    expect(text).toContain('fixed inset-0 sm:bottom-0 sm:left-0 sm:right-0 sm:top-auto z-[70]')
    expect(text).toContain('rounded-none sm:rounded-t-2xl')
    expect(text).toContain('h-[100dvh] max-h-[100dvh] sm:h-auto sm:max-h-[85vh]')
  })
})
