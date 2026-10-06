import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'

/**
 * Blutwerte, Etappe 1: der Bereich spricht Deutsch und Englisch, Marker
 * erscheinen mit englischem Namen und Erklaerung, Loeschen laeuft ueber ein
 * eigenes Sheet statt des Browser-Fensters. In der Datenbank bleibt der
 * deutsche Markername der Schluessel.
 */

function wert(mock: MockSupabase, marker: string, felder: Record<string, unknown> = {}) {
  return mock.insert('bloodwork', {
    user_id: TEST_USER.id, tested_at: '2026-09-15', marker, value: 12, unit: 'µg/dL', notes: null,
    report_id: null, ref_min: null, ref_max: null, ...felder,
  })
}

test.describe('auf Englisch', () => {
  test.use({ language: 'en' })

  test('Marker, Kategorien und Erklaerung erscheinen auf Englisch', async ({ page, mock }) => {
    wert(mock, 'Kortisol', { value: 30, unit: 'µg/dL', ref_min: 5, ref_max: 25 })
    await page.goto('/blutwerte')

    await expect(page.getByRole('heading', { name: 'Blood values' })).toBeVisible()
    await expect(page.getByText('Out-of-range values (1)')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Hormones' })).toBeVisible()
    await expect(page.getByText('Kortisol')).toHaveCount(0)

    await page.getByRole('button', { name: /Cortisol/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Cortisol' })).toBeVisible()
    await expect(page.getByText('The central stress hormone.', { exact: false })).toBeVisible()
    await expect(page.getByText('Out of range', { exact: true })).toBeVisible()
    await expect(page.getByText('09/15/2026')).toBeVisible()
  })
})

test('Loeschen: eigenes Sheet statt Browser-Fenster; Abbrechen laesst den Wert stehen', async ({ page, mock }) => {
  wert(mock, 'Kortisol', { value: 14 })
  let browserFenster = false
  page.on('dialog', dialog => { browserFenster = true; void dialog.dismiss() })

  await page.goto('/blutwerte')
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  await page.locator('[data-bw-entry-delete]').click()

  const sheet = page.getByRole('alertdialog', { name: 'Wert löschen?' })
  await expect(sheet).toContainText('Kortisol vom 15.09.2026 wird entfernt.')
  await sheet.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(sheet).toBeHidden()
  expect(mock.table('bloodwork')).toHaveLength(1)

  await page.locator('[data-bw-entry-delete]').click()
  await page.locator('[data-bw-delete-confirm]').click()
  await expect(page.getByText('Blutwert gelöscht')).toBeVisible()
  expect(mock.table('bloodwork')).toHaveLength(0)
  expect(browserFenster).toBe(false)
})
