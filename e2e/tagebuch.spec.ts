import { expect, test } from './support/fixtures'
import { TEST_USER, type MockSupabase } from './support/mockSupabase'
import { seedPeptide } from './support/myStack'

/** Tagebuch: Eintraege anlegen, bearbeiten, loeschen — und Fehler sichtbar machen. */

function eintrag(mock: MockSupabase, felder: Record<string, unknown>) {
  return mock.insert('effects', {
    user_id: TEST_USER.id, type: 'side_effect', description: 'Kopfschmerz', severity: 2,
    status: 'eingetreten', duration: '2 Std', occurred_at: '2026-09-27T08:00:00.000Z',
    notes: null, stack_item_id: null, dose_log_id: null, ...felder,
  })
}

test('Bearbeiten: Formular ist vorbefuellt (auch alte Dauer-Texte), Speichern aendert den Eintrag statt einen neuen anzulegen', async ({ page, mock }) => {
  seedPeptide(mock, 'BPC-157', { startDate: '2026-09-01' })
  const item = mock.table('stack_items').find(row => row.display_name === 'BPC-157')!
  eintrag(mock, { stack_item_id: item.id })
  await page.goto('/tagebuch')

  await expect(page.getByText('Kopfschmerz')).toBeVisible()
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await expect(page.getByRole('heading', { name: 'Eintrag bearbeiten' })).toBeVisible()

  await expect(page.locator('input[value="Kopfschmerz"]')).toBeVisible()
  await expect(page.getByRole('button', { name: '2 Std', exact: true })).toHaveClass(/bg-sky-500/)
  await expect(page.locator('select.select').last()).toHaveValue(String(item.id))

  await page.locator('input[value="Kopfschmerz"]').fill('Leichter Kopfschmerz')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Eintrag aktualisiert')).toBeVisible()

  expect(mock.table('effects')).toHaveLength(1)
  expect(mock.table('effects')[0]).toMatchObject({
    description: 'Leichter Kopfschmerz', severity: 2, duration: 'std_2', stack_item_id: item.id, status: 'eingetreten',
  })
  await expect(page.getByText('Leichter Kopfschmerz')).toBeVisible()
})

test('Bearbeiten: eine eigene Dauer erscheint im Freitextfeld', async ({ page, mock }) => {
  eintrag(mock, { duration: '3 Tage, schwankend' })
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await expect(page.locator('input[value="3 Tage, schwankend"]')).toBeVisible()
})

test('Neu nach Bearbeiten: das Formular ist leer und legt einen neuen Eintrag an', async ({ page, mock }) => {
  eintrag(mock, {})
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Eintrag bearbeiten' }).click()
  await page.getByRole('button', { name: 'Abbrechen' }).click()

  await page.getByRole('button', { name: 'Neu' }).click()
  await expect(page.getByRole('heading', { name: 'Neuer Tagebuch-Eintrag' })).toBeVisible()
  await expect(page.locator('input[value="Kopfschmerz"]')).toHaveCount(0)
})

test('Loeschen: der Eintrag ist weg', async ({ page, mock }) => {
  eintrag(mock, {})
  await page.goto('/tagebuch')
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'Eintrag löschen?' }).click()
  await expect(page.getByText('Kopfschmerz')).toHaveCount(0)
  expect(mock.table('effects')).toHaveLength(0)
})

test('Neu: eine vorgegebene Dauer wird als Schluessel gespeichert und uebersetzt angezeigt', async ({ page, mock }) => {
  await page.goto('/tagebuch')
  await page.getByRole('button', { name: 'Neu' }).click()
  await page.getByPlaceholder(/Besserer Schlaf/).fill('Mehr Energie')
  await page.getByRole('button', { name: '4 Std', exact: true }).click()
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.getByText('Eintrag gespeichert')).toBeVisible()

  expect(mock.table('effects')).toHaveLength(1)
  expect(mock.table('effects')[0]).toMatchObject({ description: 'Mehr Energie', duration: 'std_4' })
  await expect(page.getByText('4 Std')).toBeVisible()
})

test('Anzeige: ein schon umgestellter Eintrag zeigt die Uebersetzung, Freitext bleibt Freitext', async ({ page, mock }) => {
  eintrag(mock, { description: 'A', duration: 'woche_1', occurred_at: '2026-09-27T08:00:00.000Z' })
  eintrag(mock, { description: 'B', duration: 'mal so, mal so', occurred_at: '2026-09-26T08:00:00.000Z' })
  await page.goto('/tagebuch')
  await expect(page.getByText('1 Woche')).toBeVisible()
  await expect(page.getByText('mal so, mal so')).toBeVisible()
  await expect(page.getByText('woche_1')).toHaveCount(0)
})
