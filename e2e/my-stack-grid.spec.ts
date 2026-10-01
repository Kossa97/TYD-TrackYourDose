import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import type { MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'

/**
 * Das Raster: alle Substanzen auf einem Bildschirm, Antippen oeffnet das
 * Vollbild. Gemischte Darreichungsformen, damit hohe und breite Objekte
 * nebeneinander stehen.
 */
const FORMEN = ['vial', 'pen', 'tablet', 'capsule', 'nasal_spray', 'ampoule', 'drops', 'spray', 'patch', 'tube', 'gel', 'powder']

function seedSubstanzen(mock: MockSupabase, anzahl: number): string[] {
  const namen = (mock.table('substance_catalog') as Array<{ canonical_name: string }>)
    .map(row => row.canonical_name)
    .slice(0, anzahl)
  namen.forEach((name, i) => seedPeptide(mock, name, { startDate: '2026-09-01', dosageForm: FORMEN[i % FORMEN.length] }))
  return namen
}

async function oeffneRaster(page: Page) {
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'grid'))
  await page.goto('/my-stack')
  await expect(page.locator('[data-grid-index="0"]')).toBeVisible()
}

for (const anzahl of [1, 4, 11]) {
  test(`Raster mit ${anzahl}: alles auf einem Bildschirm, nichts unter der Tableiste`, async ({ page, mock }, testInfo) => {
    // Das iPhone SE ist 320 px breit: dort haben nur zwei Kacheln nebeneinander
    // Platz, und elf rollen (siehe den Test mit 25).
    test.skip(testInfo.project.name === 'iphone-se' && anzahl > 6, 'zu schmal fuer elf Kacheln ohne Scrollen')
    seedSubstanzen(mock, anzahl)
    await oeffneRaster(page)
    const flaeche = page.locator('[data-my-stack-grid-area]')
    await expect(flaeche).toHaveAttribute('data-raster-passt', 'true')
    await expect(page.locator('[data-grid-index]')).toHaveCount(anzahl)

    const leiste = await page.getByRole('navigation', { name: 'Navigation' }).boundingBox()
    const letzte = await page.locator(`[data-grid-index="${anzahl - 1}"]`).boundingBox()
    expect(letzte && leiste && letzte.y + letzte.height).toBeLessThanOrEqual(leiste!.y)
    expect(await flaeche.evaluate(el => el.scrollHeight <= el.clientHeight)).toBe(true)
  })
}

test('Raster mit 25: wird gescrollt statt unlesbar klein', async ({ page, mock }) => {
  seedSubstanzen(mock, 25)
  await oeffneRaster(page)
  const flaeche = page.locator('[data-my-stack-grid-area]')
  await expect(flaeche).toHaveAttribute('data-raster-passt', 'false')
  expect(await flaeche.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  const kachel = await page.locator('[data-grid-index="0"]').boundingBox()
  expect(kachel!.height).toBeGreaterThanOrEqual(100)
})

test('Raster: Antippen öffnet das Vollbild der Substanz, Schließen führt zurück', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 6)
  await oeffneRaster(page)

  await page.getByRole('button', { name: namen[4], exact: true }).click()
  const vollbild = page.getByRole('dialog', { name: namen[4] })
  await expect(vollbild).toBeVisible()
  await expect(vollbild.getByRole('heading', { name: namen[4] })).toBeVisible()

  await vollbild.getByRole('button', { name: 'Schließen' }).click()
  await expect(vollbild).toBeHidden()
  await expect(page.locator('[data-grid-index]')).toHaveCount(6)
})

test('Umschalter: Karussell → Raster → Liste, die Wahl bleibt nach dem Neuladen', async ({ page, mock }) => {
  seedSubstanzen(mock, 3)
  await page.goto('/my-stack')
  await expect(page.locator('[data-vial-index="0"]')).toBeVisible()

  await page.getByRole('button', { name: 'Sortierung', exact: true }).click()
  await page.getByRole('button', { name: 'Raster' }).click()
  await expect(page.locator('[data-grid-index]')).toHaveCount(3)
  await expect(page.locator('[data-vial-index]')).toHaveCount(0)

  await page.reload()
  await expect(page.locator('[data-grid-index]')).toHaveCount(3)
})
