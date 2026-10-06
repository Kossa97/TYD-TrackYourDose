import { expect, test } from './support/fixtures'
import { TEST_USER } from './support/mockSupabase'

/**
 * Blutwerte, Etappe 0: Der Befund-Import schickt die Datei an einen
 * KI-Dienst (Anthropic). Vorher steht die ausdrueckliche Einwilligung —
 * ohne sie wird nichts gesendet, und sie laesst sich im Profil widerrufen.
 */

const BEFUND = { name: 'befund.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% Testbefund\n') }

test('Import fragt zuerst nach der Einwilligung; erst danach geht eine Datei raus', async ({ page, mock }) => {
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: 'Import' }).click()

  const einwilligung = page.locator('[data-ai-consent]')
  await expect(einwilligung).toContainText('Anthropic')
  await expect(einwilligung).toContainText('Name, Geburtsdatum und Adresse')
  // Keine Datei-Knoepfe, solange nicht eingewilligt ist.
  await expect(page.getByRole('button', { name: 'Foto' })).toHaveCount(0)
  await expect(einwilligung.locator('[data-ai-consent-accept]')).toBeDisabled()

  await einwilligung.locator('[data-ai-consent-check]').check()
  await einwilligung.locator('[data-ai-consent-accept]').click()
  await expect(page.locator('[data-ai-consent-note]')).toContainText('Anthropic')
  expect(mock.table('profiles').find(row => row.id === TEST_USER.id)?.ai_import_consent_at).toBeTruthy()
  expect(mock.extractCalls).toHaveLength(0)

  await page.locator('input[type="file"][accept*="application/pdf"]').first().setInputFiles(BEFUND)
  await expect(page.getByText('Ferritin')).toBeVisible()
  expect(mock.extractCalls).toEqual([{ mimeType: 'application/pdf' }])

  await page.getByRole('button', { name: '1 übernehmen' }).click()
  await expect.poll(() => mock.table('bloodwork').length).toBe(1)
  expect(mock.table('bloodwork')[0]).toMatchObject({ marker: 'Ferritin', value: 85, tested_at: '2026-09-15' })
})

test('Abbrechen bei der Einwilligung: nichts gespeichert, nichts gesendet', async ({ page, mock }) => {
  await page.goto('/blutwerte')
  await page.getByRole('button', { name: 'Import' }).click()
  await page.locator('[data-ai-consent]').getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.locator('[data-ai-consent]')).toHaveCount(0)
  expect(mock.table('profiles').find(row => row.id === TEST_USER.id)?.ai_import_consent_at ?? null).toBeNull()
  expect(mock.extractCalls).toHaveLength(0)
})

test('Widerruf im Profil: danach fragt der Import wieder', async ({ page, mock }) => {
  Object.assign(mock.table('profiles').find(row => row.id === TEST_USER.id)!, { ai_import_consent_at: '2026-10-01T08:00:00.000Z' })
  await page.goto('/profil')
  const karte = page.locator('[data-ai-consent-profile]')
  await expect(karte).toContainText('Erlaubt seit')
  await karte.locator('[data-ai-consent-withdraw]').click()
  await expect(karte).toContainText('Nicht erlaubt')
  expect(mock.table('profiles').find(row => row.id === TEST_USER.id)?.ai_import_consent_at).toBeNull()

  await page.goto('/blutwerte')
  await page.getByRole('button', { name: 'Import' }).click()
  await expect(page.locator('[data-ai-consent]')).toBeVisible()
})
