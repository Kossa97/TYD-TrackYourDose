import type { Page } from '@playwright/test'
import { expect, test } from './support/fixtures'
import type { MockSupabase } from './support/mockSupabase'
import { seedPeptide, stageObject } from './support/myStack'

/**
 * Das Raster im Vollbild: aus dem Karussell herausgezoomt, mit allen
 * Substanzen und nur einem X. Gemischte Formen und Kategorien.
 */
const FORMEN = ['vial', 'pen', 'tablet', 'capsule', 'nasal_spray', 'ampoule', 'drops', 'spray', 'patch', 'tube', 'gel', 'powder']

function seedSubstanzen(mock: MockSupabase, anzahl: number): string[] {
  const namen = (mock.table('substance_catalog') as Array<{ canonical_name: string }>)
    .map(row => row.canonical_name)
    .slice(0, anzahl)
  namen.forEach((name, i) => seedPeptide(mock, name, {
    startDate: '2026-09-01',
    dosageForm: FORMEN[i % FORMEN.length],
    // Jede dritte ist ein Medikament: das Raster zeigt trotzdem alle.
    category: i % 3 === 2 ? 'medication' : 'peptide',
  }))
  return namen
}

async function oeffneRaster(page: Page) {
  await page.getByRole('button', { name: 'Sortierung', exact: true }).click()
  await page.getByRole('button', { name: 'Raster' }).click()
  const raster = page.getByRole('dialog', { name: 'Raster' })
  await expect(raster).toBeVisible()
  // Die Animation ist durch, wenn das X ganz da ist.
  await expect.poll(() => raster.getByRole('button', { name: 'Schließen' }).evaluate(el => getComputedStyle(el.parentElement!).opacity)).toBe('1')
  return raster
}

test('Raster: zeigt alle Substanzen, auch aus anderen Reitern, ohne Kopf und Tableiste', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 9)
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()
  await page.getByRole('tab', { name: /^Peptide/ }).click()

  const raster = await oeffneRaster(page)
  await expect(raster.locator('[data-zoom-index]')).toHaveCount(9)
  for (const name of namen) await expect(raster.getByRole('button', { name, exact: true })).toBeVisible()

  // Vier Spalten.
  const spalten = await raster.locator('[data-zoom-index]').evaluateAll(kacheln =>
    new Set(kacheln.map(k => Math.round(k.getBoundingClientRect().left))).size)
  expect(spalten).toBe(4)

  // Alles andere liegt darunter: das Raster deckt die Tableiste zu.
  const leiste = await page.getByRole('navigation', { name: 'Navigation' }).boundingBox()
  const oben = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('[data-zoom-raster]') !== null,
    { x: leiste!.x + leiste!.width / 2, y: leiste!.y + leiste!.height / 2 })
  expect(oben).toBe(true)
})

test('Raster: Antippen öffnet das Vollbild, Schließen führt ins Raster, X ins Karussell', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 6)
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()
  const raster = await oeffneRaster(page)

  await raster.getByRole('button', { name: namen[2], exact: true }).click()
  const vollbild = page.getByRole('dialog', { name: namen[2] })
  await expect(vollbild).toBeVisible()
  await vollbild.getByRole('button', { name: 'Schließen' }).click()
  await expect(vollbild).toBeHidden()
  await expect(raster).toBeVisible()

  // Escape schliesst nur das Oberste: das Vollbild, nicht das Raster darunter.
  await raster.getByRole('button', { name: namen[2], exact: true }).click()
  await expect(vollbild).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(vollbild).toBeHidden()
  // Laenger als die Schliess-Feder: schloesse Escape auch das Raster, waere
  // es bis dahin weg.
  await page.waitForTimeout(1200)
  await expect(raster).toBeVisible()

  await raster.getByRole('button', { name: 'Schließen' }).click()
  await expect(raster).toBeHidden()
  // Zurueck im Karussell, bei der zuletzt geoeffneten Substanz — und sie
  // ist wieder sichtbar (waehrend des Flugs war ihr Platz verdeckt).
  const slot = stageObject(page, namen[2])
  await expect(slot).toBeInViewport({ ratio: 0.9 })
  await expect(slot).toHaveCSS('visibility', 'visible')
})

test('Raster: ohne Bewegung erscheint es sofort, und die App startet danach im Karussell', async ({ page, mock }) => {
  const namen = seedSubstanzen(mock, 4)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  // Ein gespeichertes „grid" aus der vorigen Version wird zum Karussell.
  await page.addInitScript(() => localStorage.setItem('tyd_peptide_view', 'grid'))
  await page.goto('/my-stack')
  await expect(stageObject(page, namen[0])).toBeVisible()

  const raster = await oeffneRaster(page)
  await expect(raster.locator('[data-zoom-index]')).toHaveCount(4)
  await page.keyboard.press('Escape')
  await expect(raster).toBeHidden()
})
