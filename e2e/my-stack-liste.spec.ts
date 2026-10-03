import { expect, test } from './support/fixtures'
import { seedPeptide } from './support/myStack'

/**
 * My Stack als Liste: je Substanz eine kompakte Zeile — fuer jede
 * Darreichungsform gleich: Name, aktiv/inaktiv, Zusammensetzung,
 * Haltbarkeit. Ein Tipp oeffnet das Vollbild; Bearbeiten und Loeschen
 * stehen dort, nicht auf der Zeile.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'list'))
})

function zeile(page: import('@playwright/test').Page, name: string) {
  return page.locator('[data-list-row]', { has: page.getByText(name, { exact: true }) })
}

test('Liste: Name, Zusammensetzung, Haltbarkeit und aktiv/inaktiv — für jede Form', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2, expires_at: '2027-03-31' },
  })
  // Eine Tablette ohne Plan: inaktiv, und ihre Haltbarkeit ist bald um.
  seedPeptide(mock, 'Magnesium', {
    startDate: '2026-09-01',
    category: 'supplement',
    plan: false,
    form: { dosage_form: 'tablet', zutat: { amount_value: 400, amount_unit: 'mg', basis_value: 1, basis_unit: 'tablet' } },
    inventory: { package_quantity: 60, package_unit: 'tablet', remaining_quantity: 40, expires_at: '2026-10-01' },
  })
  await page.goto('/my-stack')

  const bpc = zeile(page, 'BPC-157')
  await expect(bpc).toBeVisible()
  await expect(bpc).toContainText('Aktiv')
  await expect(bpc).toContainText('5 mg / 2 ml')
  await expect(bpc).toContainText('Haltbar bis 31.03.2027')

  const magnesium = zeile(page, 'Magnesium')
  await expect(magnesium).toContainText('Inaktiv')
  await expect(magnesium).toContainText('400 mg / 1 Tablette')
  await expect(magnesium).toContainText('Läuft in 3 Tagen ab')

  // Nur diese vier Angaben: keine Einnahme, kein Vorrat, keine Aktionen.
  await expect(bpc).not.toContainText('250 mcg')
  await expect(bpc).not.toContainText('Vials')
  await expect(bpc.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
  await expect(bpc.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)

  // Kompakt: deutlich mehr als drei Substanzen passen auf einen Bildschirm.
  expect((await bpc.boundingBox())!.height).toBeLessThanOrEqual(96)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('Liste: Antippen öffnet das Vollbild, Zurück schließt es', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  await page.goto('/my-stack')

  await page.getByRole('button', { name: 'BPC-157 öffnen' }).click()
  const detail = page.getByRole('dialog', { name: 'BPC-157' })
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Löschen' })).toBeVisible()
  await expect(detail.getByText('Nächste Einnahme')).toBeVisible()

  await page.goBack()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('button', { name: 'BPC-157 öffnen' })).toBeVisible()
})
