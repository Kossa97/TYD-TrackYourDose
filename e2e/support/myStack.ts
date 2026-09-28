import { expect, type Locator, type Page } from '@playwright/test'
import type { MockSupabase } from './mockSupabase'

/** Der Schritt, auf dem der Assistent steht („Substanz", „Einnahmeplan", …) — die Zeile unter der Ueberschrift. */
async function stepName(dialog: Locator): Promise<string> {
  return (await dialog.locator('p').nth(1).innerText()).trim()
}

/** „Weiter" und warten, bis der naechste Schritt wirklich da ist. */
export async function next(dialog: Locator, expected?: string): Promise<void> {
  const before = await stepName(dialog)
  await dialog.getByRole('button', { name: 'Weiter', exact: true }).click()
  if (expected) await expect.poll(() => stepName(dialog)).toBe(expected)
  else await expect.poll(() => stepName(dialog)).not.toBe(before)
}

export async function expectStep(dialog: Locator, name: string): Promise<void> {
  await expect.poll(() => stepName(dialog)).toBe(name)
}

/** Die Buehne: das Objekt einer Substanz im Karussell. */
export function stageObject(page: Page, name: string): Locator {
  return page.locator('[data-vial-index]', { has: page.getByText(name, { exact: true }) }).first()
}

/**
 * BPC-157 als Vial mit taeglichem Plan anlegen — so, wie der Assistent es
 * speichert, aber ohne durch ihn zu gehen.
 */
export function seedBpc157(mock: MockSupabase, options: { startDate: string }): void {
  mock.callRpc('save_stack_item_with_plan', {
    p_item: {
      id: null, display_name: 'BPC-157', category: 'peptide', tracking_level: 'complete', dosage_form: 'vial',
      brand: null, color_hex: '#10b981', notes: null, pk_profile_method: null,
      inventory: { enabled: false, package_quantity: null, package_unit: null, remaining_quantity: null, batch_number: null, expires_at: null },
    },
    p_ingredients: [{
      catalog_substance_id: mock.catalogId('BPC-157'), custom_name: 'BPC-157',
      amount_value: 5, amount_unit: 'mg', basis_value: 2, basis_unit: 'ml', position: 0,
    }],
    p_plan: {
      id: null, name: 'BPC-157', dose: 250, unit: 'mcg', method: 'Subkutan', frequency: 'Täglich',
      x_days_interval: null, interval_unit: null, cycle_on_days: null, cycle_off_days: null, schedule_days: [],
      start_date: options.startDate, end_date: null, intake_time: 'morgens', intake_time_custom: null,
      slot_doses: null, slot_days: null, reminder: [], timezone: 'Europe/Berlin',
    },
    p_idempotency_key: 'seed-bpc-157',
  })
}
