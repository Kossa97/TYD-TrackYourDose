import { expect, test } from './support/fixtures'
import { seedPeptide } from './support/myStack'

/**
 * My Stack als Liste: je Substanz eine kompakte Zeile, ein Tipp oeffnet das
 * Vollbild. Bearbeiten und Loeschen stehen dort, nicht auf der Zeile.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'list'))
})

test('Liste: kompakte Zeile mit nächster Einnahme, Vorrat und Stärke', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', {
    startDate: '2026-09-01',
    inventory: { package_quantity: 5, package_unit: 'vial', remaining_quantity: 3, reconstitution_ml: 2 },
  })
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01', plan: false })
  await page.goto('/my-stack')

  const bpc = page.locator('[data-list-row]', { has: page.getByText('BPC-157', { exact: true }) })
  await expect(bpc).toBeVisible()
  // 10:00 Uhr: die Einnahme am Morgen ist vorbei, die naechste ist morgen.
  await expect(bpc).toContainText(/Morgen, \d{2}:\d{2} · 250 mcg/)
  await expect(bpc).toContainText('Vial · 5 mg / 2 ml')
  // Keine Aktionen auf der Zeile.
  await expect(bpc.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
  await expect(bpc.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)

  // Ohne Plan: der eine fehlende Schritt steht neben der Zeile.
  const tb = page.locator('[data-list-row]', { has: page.getByText('TB-500', { exact: true }) })
  await expect(tb).toContainText('Noch kein Zyklus')
  await expect(tb.getByRole('button', { name: 'Plan anlegen' })).toBeVisible()

  // Kompakt: deutlich mehr als drei Substanzen passen auf einen Bildschirm.
  const hoehe = (await bpc.boundingBox())!.height
  expect(hoehe).toBeLessThanOrEqual(96)

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

test('Liste: „Plan anlegen" öffnet den Plan für genau diese Substanz', async ({ page, mock }) => {
  seedPeptide(mock, 'TB-500', { startDate: '2026-09-01', plan: false })
  await page.goto('/my-stack')

  const tb = page.locator('[data-list-row]', { has: page.getByText('TB-500', { exact: true }) })
  await tb.getByRole('button', { name: 'Plan anlegen' }).click()
  await expect(page.getByRole('dialog').filter({ hasText: 'TB-500' }).first()).toBeVisible()
  // Das Vollbild oeffnet sich dabei nicht.
  await expect(page.getByRole('dialog', { name: 'TB-500' })).toHaveCount(0)
})
