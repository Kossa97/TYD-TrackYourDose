import { expect, test } from './support/fixtures'
import { RpcError } from './support/mockSupabase'
import { expectStep, next, seedBpc157, stageObject } from './support/myStack'

/**
 * My Stack auf dem Geraet: Anlegen, Bearbeiten, Plan aendern, Speichern.
 *
 * Die Unit-Tests pruefen die Teile einzeln; hier laeuft der ganze Weg im
 * Browser — Tippen, Schritte, Speichern, Neuladen, was danach auf dem
 * Bildschirm steht — gegen ein nachgebildetes Supabase.
 */

test('Anlegen: BPC-157 aus dem Katalog, mit Plan, steht danach auf der Bühne', async ({ page, mock }) => {
  await page.goto('/my-stack')
  await expect(page.getByText('Noch keine Substanzen')).toBeVisible()

  await page.getByRole('button', { name: 'Neue Substanz' }).click()
  const wizard = page.getByRole('dialog', { name: 'Substanz hinzufügen' })
  await wizard.getByRole('searchbox').fill('BPC-157')
  await wizard.getByRole('option', { name: /^BPC-157 Body/ }).click()

  await next(wizard, 'Darreichungsform')
  await expect(wizard.getByRole('button', { name: 'Vial' })).toHaveAttribute('aria-pressed', 'true')
  await next(wizard, 'Farbe')
  await next(wizard, 'Tracking-Tiefe')
  await next(wizard, 'Stärke')
  await wizard.getByRole('spinbutton', { name: 'Wirkstoff im Vial' }).fill('5')
  await wizard.getByRole('spinbutton', { name: 'Lösungsmittel' }).fill('2')
  await next(wizard, 'Einnahmeplan')
  await wizard.getByRole('combobox', { name: 'Methode' }).selectOption('Subkutan')
  await wizard.getByRole('spinbutton', { name: /^Menge/ }).fill('250')
  await wizard.getByRole('combobox', { name: 'Einheit' }).fill('mcg')
  await next(wizard, 'Zusammenfassung')
  await expect(wizard.getByText('Morgens · 250 mcg')).toBeVisible()

  await wizard.getByRole('button', { name: 'Speichern' }).click()
  await expect(wizard).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'Substanz hinzugefügt' })).toBeVisible()

  // Was beim Backend ankam.
  const save = mock.rpcCalls.find(call => call.name === 'save_stack_item_with_plan')
  expect(save?.params).toMatchObject({
    p_item: { display_name: 'BPC-157', category: 'peptide', dosage_form: 'vial' },
    p_ingredients: [{ catalog_substance_id: mock.catalogId('BPC-157'), amount_value: 5, amount_unit: 'mg', basis_value: 2, basis_unit: 'ml' }],
    p_plan: { dose: 250, unit: 'mcg', method: 'Subkutan', frequency: 'Täglich', intake_time: 'morgens', start_date: '2026-09-28' },
  })

  // Der neue Eintrag steht in der Mitte — nicht die „Neu"-Kachel davor.
  const vial = stageObject(page, 'BPC-157')
  await expect(vial).toBeInViewport({ ratio: 0.9 })
  await expect(page.locator('[data-vial-add]')).not.toBeInViewport({ ratio: 0.5 })

  // Nichts ragt seitlich aus dem Bildschirm.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('Bearbeiten: Notiz ergänzen speichert nur den Eintrag', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()

  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  const edit = page.getByRole('dialog', { name: 'Eintrag bearbeiten' })
  await expectStep(edit, 'Was möchtest du ändern?')
  await edit.getByRole('button', { name: /^Produkt & Notizen/ }).click()
  await expectStep(edit, 'Produkt & Notizen')
  await edit.getByRole('textbox', { name: 'Notizen (optional)' }).fill('Im Kühlschrank lagern')
  await edit.getByRole('button', { name: 'Fertig' }).click()
  await expectStep(edit, 'Was möchtest du ändern?')
  await expect(edit.getByRole('button', { name: /^Produkt & Notizen/ })).toContainText('Im Kühlschrank lagern')

  await edit.getByRole('button', { name: 'Speichern' }).click()
  await expect(edit).toBeHidden()
  await expect(page.getByRole('status').filter({ hasText: 'aktualisiert' })).toBeVisible()

  expect(mock.rpcCalls.map(call => call.name)).toEqual(['save_stack_item'])
  expect(mock.rpcCalls[0].params).toMatchObject({
    p_item: { display_name: 'BPC-157', notes: 'Im Kühlschrank lagern' },
  })
  // Beim Bearbeiten geht der Bestand NICHT mit (sonst ueberschriebe er den Rest).
  expect(mock.rpcCalls[0].params.p_item).not.toHaveProperty('inventory')
  await expect(detail.getByText('Im Kühlschrank lagern')).toBeVisible()
})

test('Plan ändern: neue Menge ab sofort wird eine neue Planstufe', async ({ page, mock }) => {
  seedBpc157(mock, { startDate: '2026-09-01' })
  await page.goto('/my-stack')
  await stageObject(page, 'BPC-157').click()

  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await expect(detail.getByText('Tag 28')).toBeVisible()
  await detail.getByRole('button', { name: 'Plan & Verlauf öffnen' }).click()
  await page.getByRole('button', { name: 'Plan anpassen' }).click()

  const plan = page.getByRole('dialog', { name: 'Plan anpassen' })
  await expect(plan.getByRole('radio', { name: 'Ab sofort' })).toBeChecked()
  await plan.getByRole('spinbutton', { name: /^Menge/ }).fill('500')
  await plan.getByRole('button', { name: 'Speichern' }).click()
  await expect(plan).toBeHidden()

  const change = mock.rpcCalls.find(call => call.name === 'create_plan_version')
  expect(change?.params).toMatchObject({
    p_change_kind: 'dose',
    p_schedule: { dose: 500, unit: 'mcg', frequency: 'Täglich', method: 'Subkutan' },
  })
  // Die alte Stufe bleibt im Verlauf; auf dem Bildschirm steht die neue Menge.
  expect(mock.table('cycle_plan_versions')).toHaveLength(2)
  await expect(page.getByText('500 mcg').first()).toBeVisible()
})

test('Speichern scheitert: Meldung mit Grund, Assistent bleibt offen, nichts angelegt', async ({ page, mock }) => {
  mock.onRpc('save_stack_item_with_plan', () => {
    throw new RpcError('Another open cycle exists')
  })
  await page.goto('/my-stack')
  await page.getByRole('button', { name: 'Neue Substanz' }).click()
  const wizard = page.getByRole('dialog', { name: 'Substanz hinzufügen' })
  await wizard.getByRole('searchbox').fill('BPC-157')
  await wizard.getByRole('option', { name: /^BPC-157 Body/ }).click()
  await next(wizard, 'Darreichungsform')
  await next(wizard, 'Farbe')
  await next(wizard, 'Tracking-Tiefe')
  await next(wizard, 'Stärke')
  await wizard.getByRole('spinbutton', { name: 'Wirkstoff im Vial' }).fill('5')
  await wizard.getByRole('spinbutton', { name: 'Lösungsmittel' }).fill('2')
  await next(wizard, 'Einnahmeplan')
  await wizard.getByRole('combobox', { name: 'Methode' }).selectOption('Subkutan')
  await wizard.getByRole('spinbutton', { name: /^Menge/ }).fill('250')
  await next(wizard, 'Zusammenfassung')

  await wizard.getByRole('button', { name: 'Speichern' }).click()
  await expect(wizard.getByRole('alert')).toContainText('Another open cycle exists')
  await expect(wizard).toBeVisible()
  expect(mock.table('stack_items')).toHaveLength(0)
})
