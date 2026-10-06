import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'

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
  await page.getByRole('button', { name: 'Wert vom 15.09.2026 löschen' }).click()

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

test('Bearbeiten: Einzelwert aendert Datum, Wert und Einheit', async ({ page, mock }) => {
  const eintrag = wert(mock, 'Kortisol', { value: 14, notes: 'nuechtern' })
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  await page.getByRole('button', { name: 'Wert vom 15.09.2026 bearbeiten' }).click()

  await expect(page.getByRole('heading', { name: 'Wert bearbeiten' })).toBeVisible()
  // Marker ist fest, kein Auswahlfeld
  await expect(page.locator('[data-app-modal] select')).toHaveCount(0)
  await page.locator('[data-app-modal] input[type="date"]').fill('2026-09-14')
  await page.getByPlaceholder('42.5').fill('16,5')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByText('Wert geändert')).toBeVisible()
  const [zeile] = mock.table('bloodwork')
  expect(zeile).toMatchObject({ id: eintrag.id, tested_at: '2026-09-14', value: 16.5, unit: 'µg/dL', notes: 'nuechtern' })
  // erneut geoeffnet: Dezimalkomma wie eingegeben
  await page.getByRole('button', { name: 'Wert vom 14.09.2026 bearbeiten' }).click()
  await expect(page.getByPlaceholder('42.5')).toHaveValue('16,5')
})

test('Bearbeiten: Wert aus einem Befund — Datum bleibt beim Befund, Referenz bleibt', async ({ page, mock }) => {
  const befund = mock.insert('bloodwork_reports', { user_id: TEST_USER.id, tested_at: '2026-09-15', lab_name: null, source: 'import' })
  wert(mock, 'Kortisol', { value: 14, report_id: befund.id, ref_min: 5, ref_max: 25 })
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/liste.png`, fullPage: true })
  await page.getByRole('button', { name: 'Wert vom 15.09.2026 bearbeiten' }).click()

  const datum = page.locator('[data-app-modal] input[type="date"]')
  await expect(datum).toBeDisabled()
  await expect(page.getByText('Das Datum gehört zum Befund, aus dem der Wert stammt.')).toBeVisible()
  if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.SCREENSHOT_DIR}/bearbeiten.png` })
  await page.getByPlaceholder('42.5').fill('20')
  await page.getByRole('button', { name: 'Speichern' }).click()

  await expect(page.getByText('Wert geändert')).toBeVisible()
  expect(mock.table('bloodwork')[0]).toMatchObject({ tested_at: '2026-09-15', value: 20, report_id: befund.id, ref_min: 5, ref_max: 25 })
})

test('Verlauf: Zyklen aus My Stack als Zeilen unter dem Diagramm', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-08-01' })
  seedPeptide(mock, 'TB-500', { startDate: '2026-06-10' })
  const tb = mock.table('stack_items').find(row => row.display_name === 'TB-500')!
  Object.assign(mock.table('cycles').find(row => row.stack_item_id === tb.id)!, {
    active: false, ended_at: '2026-07-20T00:00:00.000Z', end_local_date: '2026-07-20',
  })
  wert(mock, 'Kortisol', { tested_at: '2026-05-15', value: 18 })
  wert(mock, 'Kortisol', { tested_at: '2026-09-15', value: 12 })

  await page.goto('/blutwerte')
  await page.getByRole('button', { name: /Kortisol/ }).first().click()
  const streifen = page.locator('[data-cycle-strip]')
  await expect(streifen).toContainText('Deine Zyklen in diesem Zeitraum')
  await expect(streifen.locator('[data-cycle-row]')).toHaveCount(2)
  // aelteste zuerst; beendet mit Enddatum, laufend mit „läuft"
  await expect(streifen.locator('[data-cycle-row]').first()).toContainText('TB-500')
  await expect(streifen.getByRole('img', { name: 'TB-500: 10.06.2026 – 19.07.2026' })).toBeVisible()
  await expect(streifen.getByRole('img', { name: 'BPC-157: 01.08.2026 – läuft' })).toBeVisible()
  await expect(streifen).toContainText('sagt nichts über Ursache und Wirkung')

  if (process.env.SCREENSHOT_DIR) {
    await page.waitForTimeout(1600) // Linien-Animation abwarten
    for (const thema of ['dark', 'light']) {
      await page.evaluate(wert => document.documentElement.setAttribute('data-theme', wert), thema)
      await streifen.locator('..').screenshot({ path: `${process.env.SCREENSHOT_DIR}/verlauf-${thema}.png` })
    }
  }
})
